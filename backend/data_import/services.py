import csv
import os
import re
import json
from datetime import timedelta
from decimal import Decimal
from django.utils.timezone import now
from transactions.models import Transaction
from .models import BankStatement, ImportedTransaction
from pdfminer.high_level import extract_text
from openai import OpenAI

class ImportService:
    def __init__(self, statement: BankStatement):
        self.statement = statement
        self.user = statement.user
        self.openai_client = None
        if os.getenv("OPENAI_API_KEY"):
            self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def process(self):
        """
        Processes a single bank statement.
        """
        self.statement.status = BankStatement.STATUS_PROCESSING
        self.statement.save()
        try:
            ext = os.path.splitext(self.statement.file.name)[1].lower()
            print(f"[ImportService] Processing {self.statement.original_filename} (type: {ext})")

            if ext == '.csv':
                self.process_csv()
            elif ext == '.pdf':
                # 1. Extract Text
                text = self.extract_pdf_text()
                print(f"[ImportService] Extracted {len(text)} characters of text")

                # 2. Validate Account Match (Log warning but proceed)
                is_match, reason = self.validate_account_match()
                if not is_match:
                    print(f"[ImportService] Warning: {reason}")

                # 3. Parse with LLM
                self._parse_with_llm_direct(text)
            else:
                raise ValueError(f"Unsupported file format: {ext}")

            # 4. Check if any transactions were created
            transaction_count = self.statement.transactions.count()
            print(f"[ImportService] Created {transaction_count} transactions")

            if transaction_count == 0:
                raise ValueError("No transactions were extracted from the statement. The file may be empty, scanned (requiring OCR), or in an unsupported format.")

            # 5. Finalize
            self.deduplicate()
            self.statement.status = BankStatement.STATUS_REVIEW
            self.statement.processed_at = now()
            self.statement.save()

            print(f"\n{'='*80}")
            print("[ImportService] IMPORT SUMMARY")
            print(f"{'='*80}")
            print(f"File: {self.statement.original_filename}")
            print(f"Total Transactions: {transaction_count}")
            print(f"Duplicates Found: {self.statement.transactions.filter(is_duplicate=True).count()}")
            print(f"Ready for Review: {self.statement.transactions.filter(selected_for_import=True).count()}")
            print(f"Status: {self.statement.status}")
            print(f"{'='*80}\n")

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"[ImportService] Process failed for {self.statement.original_filename}: {e}")
            print(f"[ImportService] Full traceback:\n{error_detail}")
            self.statement.status = BankStatement.STATUS_FAILED
            self.statement.error_message = str(e)
            self.statement.save()

    def extract_pdf_text(self):
        """Extracts text and saves to model."""
        path = self.statement.file.path
        try:
            text = extract_text(path)
            self.statement.extracted_text = text
            self.statement.save()

            return text
        except Exception as e:
            raise ValueError(f"Failed to extract text from PDF: {e}")

    def validate_account_match(self):
        """
        Checks if the statement's text contains the target account's mask or name.
        """
        if not self.statement.target_account or not self.statement.extracted_text:
            return True, "No target account or text to check."

        text = self.statement.extracted_text
        account = self.statement.target_account
        
        if account.mask and account.mask in text:
            return True, f"Matched account mask *{account.mask}"
            
        if account.account_name.lower() in text.lower():
             return True, f"Matched account name '{account.account_name}'"

        return False, f"Account match warning: Could not find *{account.mask or '????'} in text."

    def process_csv(self):
        path = self.statement.file.path
        created_count = 0
        error_count = 0

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = [h.lower().strip() for h in reader.fieldnames or []]
            print(f"CSV Headers: {headers}")

            date_col = next((h for h in headers if 'date' in h), None)
            amount_col = next((h for h in headers if 'amount' in h or 'debit' in h or 'credit' in h), None)
            desc_col = next((h for h in headers if 'description' in h or 'name' in h or 'payee' in h or 'memo' in h), None)

            print(f"Detected columns - Date: '{date_col}', Amount: '{amount_col}', Description: '{desc_col}'")

            if not (date_col and amount_col):
                raise ValueError("Could not detect Date or Amount columns in CSV.")

            print("\nProcessing rows...")
            rows_processed = 0
            sample_rows = []

            for row in reader:
                row_lower = {k.lower().strip(): v for k, v in row.items()}
                date_str = row_lower.get(date_col)
                amount_str = row_lower.get(amount_col)
                desc = row_lower.get(desc_col, "Unknown")

                if not date_str or not amount_str:
                    continue

                # Collect first 3 rows as samples
                if rows_processed < 3:
                    sample_rows.append({
                        'date': date_str,
                        'amount': amount_str,
                        'description': desc
                    })

                try:
                    amount = Decimal(re.sub(r'[^\d.-]', '', amount_str))
                    from dateutil.parser import parse
                    date_obj = parse(date_str).date()
                    ImportedTransaction.objects.create(
                        statement=self.statement,
                        date=date_obj,
                        amount=amount,
                        description=desc,
                        raw_data=row
                    )
                    created_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"  Error parsing row {rows_processed + 1}: {e}")
                    print(f"  Row data: {row}")

                rows_processed += 1

        # Print sample rows
        if sample_rows:
            print("\nSample rows (first 3):")
            for i, row in enumerate(sample_rows, 1):
                print(f"  {i}. Date: {row['date']}, Amount: {row['amount']}, Desc: {row['description']}")

        print(f"\nCSV import complete: {created_count} created, {error_count} errors")
        print(f"{'='*80}\n")

    def _parse_with_llm_direct(self, raw_text):
        """Direct LLM call."""
        if not self.openai_client:
            raise ValueError("OpenAI API Key not configured. Set OPENAI_API_KEY in your environment.")

        # Clean the text - remove null bytes and normalize whitespace
        cleaned_text = raw_text.replace('\x00', '').replace('\r\n', '\n').strip()

        print("[ImportService] Preparing to call OpenAI API...")
        print(f"[ImportService] Original text length: {len(raw_text)}, Cleaned text length: {len(cleaned_text)}")
        print(f"[ImportService] First 500 chars: {cleaned_text[:500]}")

        # Use system and user messages separately for better results
        system_message = """You are a precise financial data extractor. Extract all transactions from bank statements.
Output JSON only with format: {"transactions": [{"date": "YYYY-MM-DD", "description": "text", "amount": number}]}
Amounts: negative for debits/withdrawals, positive for credits/deposits."""

        user_message = f"""Extract all transactions from this bank statement:

{cleaned_text}

Return ONLY valid JSON with the transactions array."""

        try:
            print("[ImportService] Making OpenAI API request...")

            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                temperature=0,
                response_format={"type": "json_object"}
            )

            print("[ImportService] OpenAI API call completed")

            content = response.choices[0].message.content
            data = json.loads(content)
            transactions = data.get("transactions", [])

            print(f"[ImportService] LLM returned {len(transactions)} transactions")

            # Print first 5 transactions as sample
            if transactions:
                print("\n[ImportService] Sample transactions (first 5):")
                for i, t in enumerate(transactions[:5]):
                    print(f"  {i+1}. Date: {t.get('date')}, Amount: {t.get('amount')}, Desc: {t.get('description')}")
                if len(transactions) > 5:
                    print(f"  ... and {len(transactions) - 5} more\n")

            created_count = 0
            error_count = 0

            for t in transactions:
                try:
                    amount = Decimal(str(t['amount']))
                    from dateutil.parser import parse
                    date_obj = parse(t['date']).date()
                    ImportedTransaction.objects.create(
                        statement=self.statement,
                        date=date_obj,
                        amount=amount,
                        description=t['description'],
                        raw_data=t
                    )
                    created_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"[ImportService] Error saving transaction: {e} - Transaction data: {t}")

            print(f"[ImportService] LLM import: {created_count} created, {error_count} errors\n")

        except TimeoutError as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"[ImportService] LLM call timed out after 60 seconds: {e}")
            print(f"[ImportService] Full traceback:\n{error_detail}")
            raise ValueError("AI parsing timed out. The statement may be too complex or the API is unresponsive.")
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"[ImportService] LLM parsing failed: {e}")
            print(f"[ImportService] Full traceback:\n{error_detail}")
            raise ValueError(f"Failed to parse statement with AI: {str(e)}")

    def deduplicate(self):
        """
        Flag transactions that exist in DB.
        """
        imported = self.statement.transactions.all()
        duplicate_count = 0

        for imp in imported:
            # Rule: Exact Amount AND Date within 3 days
            start_date = imp.date - timedelta(days=3)
            end_date = imp.date + timedelta(days=3)

            matches = Transaction.objects.filter(
                account__user=self.user,
                amount=imp.amount,
                date__range=(start_date, end_date)
            )

            if matches.exists():
                imp.is_duplicate = True
                imp.duplicate_of = matches.first()
                imp.selected_for_import = False # Uncheck by default
                imp.save()
                duplicate_count += 1

        print(f"[ImportService] Deduplication: {duplicate_count} duplicates found out of {imported.count()} transactions")
