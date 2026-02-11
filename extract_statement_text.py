#!/usr/bin/env python3
"""
Extract text from text-based PDF statements (no OCR).
Optionally parse simple transaction lines into CSV.
"""

import argparse
import csv
import re
from datetime import datetime
from pathlib import Path

try:
    from pdfminer.high_level import extract_text
except ImportError as exc:
    raise SystemExit("Missing dependency. Install with: pip install pdfminer.six") from exc

DATE_RE = re.compile(
    r"^\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})\s+"
)
AMOUNT_RE = re.compile(r"[-+]?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?")

def parse_pages(spec: str | None):
    if not spec:
        return None
    pages = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            for i in range(int(start), int(end) + 1):
                pages.add(i - 1)
        else:
            pages.add(int(part) - 1)
    return sorted(pages)

def normalize_date(raw: str) -> str:
    raw = raw.strip()
    fmts = [
        "%m/%d/%Y", "%m/%d/%y",
        "%d/%m/%Y", "%d/%m/%y",
        "%Y-%m-%d", "%Y/%m/%d",
        "%d-%m-%Y", "%m-%d-%Y",
    ]
    for fmt in fmts:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return raw  # fallback if unknown format

def normalize_amount(raw: str) -> str:
    s = raw.strip()
    negative = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace(",", "")
    if negative and not s.startswith("-"):
        s = "-" + s
    return s

def parse_transactions(text: str):
    rows = []
    for line in text.splitlines():
        line = " ".join(line.split())
        if not line:
            continue
        m = DATE_RE.match(line)
        if not m:
            continue
        date_raw = m.group(1)
        rest = line[m.end():].strip()

        last_amt = None
        for amt in AMOUNT_RE.finditer(rest):
            last_amt = amt
        if not last_amt:
            continue

        amount_raw = last_amt.group(0)
        description = rest[:last_amt.start()].strip()
        if not description:
            continue

        rows.append({
            "date": normalize_date(date_raw),
            "description": description,
            "amount": normalize_amount(amount_raw),
        })
    return rows

def main():
    parser = argparse.ArgumentParser(description="Extract text from PDF statements (no OCR).")
    parser.add_argument("pdf", type=Path, help="Path to a text-based PDF statement")
    parser.add_argument("--pages", help="Pages to extract, e.g. 1-3,5")
    parser.add_argument("--out-text", type=Path, help="Write extracted text to this file")
    parser.add_argument("--out-csv", type=Path, help="Write parsed transactions to CSV")
    args = parser.parse_args()

    page_numbers = parse_pages(args.pages)
    text = extract_text(str(args.pdf), page_numbers=page_numbers)

    if args.out_text:
        args.out_text.write_text(text, encoding="utf-8")
    else:
        print(text)

    if args.out_csv:
        rows = parse_transactions(text)
        with args.out_csv.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["date", "description", "amount"])
            writer.writeheader()
            writer.writerows(rows)

if __name__ == "__main__":
    main()
