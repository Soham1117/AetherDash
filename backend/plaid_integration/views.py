import json
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .models import PlaidConnection
import plaid
from plaid.api import plaid_api
from plaid.exceptions import ApiException
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from django.conf import settings
from django.utils import timezone

# Initialize Plaid Client
def get_plaid_client():
    """Get Plaid client with proper error handling."""
    if not settings.PLAID_CLIENT_ID or not settings.PLAID_SECRET:
        raise ValueError("PLAID_CLIENT_ID and PLAID_SECRET must be set in environment variables")
    
    env_map = {
        'sandbox': plaid.Environment.Sandbox,
        'development': plaid.Environment.Development,
        'production': plaid.Environment.Production,
    }
    
    plaid_env = settings.PLAID_ENV.lower() if settings.PLAID_ENV else 'sandbox'
    plaid_host = env_map.get(plaid_env, plaid.Environment.Sandbox)
    
    configuration = plaid.Configuration(
        host=plaid_host,
        api_key={
            'clientId': settings.PLAID_CLIENT_ID,
            'secret': settings.PLAID_SECRET,
        }
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)

# Initialize client (will raise error if env vars not set)
try:
    client = get_plaid_client()
except ValueError as e:
    print(f"Warning: Plaid not configured: {e}")
    client = None

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_link_token(request):
    try:
        if not client:
            return JsonResponse({'error': 'Plaid is not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in environment variables.'}, status=500)
        
        user = request.user
        item_id = request.data.get('item_id')
        access_token = None
        if item_id:
            connection = PlaidConnection.objects.filter(user=user, item_id=item_id).first()
            if not connection:
                return JsonResponse({'error': 'Plaid connection not found for item_id.'}, status=404)
            access_token = connection.access_token

        # Create a link_token for the given user
        request_params = {
            'products': [Products('transactions')],
            'client_name': "AetherDash",
            'country_codes': [CountryCode('US')],
            'language': 'en',
            'user': LinkTokenCreateRequestUser(
                client_user_id=str(user.id)
            ),
        }
        if access_token:
            request_params['access_token'] = access_token
        request_plaid = LinkTokenCreateRequest(**request_params)
        response = client.link_token_create(request_plaid)
        return JsonResponse(response.to_dict())
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Error creating link token: {error_msg}")
        print(traceback.format_exc())
        return JsonResponse({'error': error_msg}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def exchange_public_token(request):
    try:
        if not client:
            return JsonResponse({'error': 'Plaid is not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in environment variables.'}, status=500)

        public_token = request.data.get('public_token')
        institution_id = request.data.get('institution_id')
        institution_name = request.data.get('institution_name')
        
        if not public_token:
            return JsonResponse({'error': 'Missing public_token'}, status=400)

        exchange_request = ItemPublicTokenExchangeRequest(
            public_token=public_token
        )
        exchange_response = client.item_public_token_exchange(exchange_request)
        access_token = exchange_response.access_token
        item_id = exchange_response.item_id

        # Save connection
        connection, created = PlaidConnection.objects.update_or_create(
            item_id=item_id,
            defaults={
                'user': request.user,
                'access_token': access_token,
                'institution_id': institution_id,
                'institution_name': institution_name,
            }
        )
        if institution_id:
            # Keep only the latest connection per institution to avoid duplicate accounts
            stale_connections = PlaidConnection.objects.filter(
                user=request.user,
                institution_id=institution_id
            ).exclude(item_id=item_id)
            stale_count = stale_connections.count()
            if stale_count:
                stale_connections.delete()
                print(f"[Plaid] Removed {stale_count} stale connection(s) for institution_id={institution_id}")

        # Fetch and create accounts automatically
        from accounts.models import Account
        
        accounts_response = client.accounts_get(
            AccountsGetRequest(access_token=access_token)
        )
        
        created_accounts = []
        for plaid_acc in accounts_response.accounts:
            # Map Plaid type to our choices
            type_map = {
                'depository': 'bank',
                'credit': 'credit_card',
                'investment': 'other',
                'loan': 'other',
                'brokerage': 'other',
            }
            # Handle both enum objects and strings
            acc_type = plaid_acc.type.value if hasattr(plaid_acc.type, 'value') else str(plaid_acc.type)
            our_type = type_map.get(acc_type, 'other')
            
            # Calculate balance
            current = plaid_acc.balances.current
            available = plaid_acc.balances.available
            balance_val = current if current is not None else (available or 0)
            
            # Handle subtype - can be enum or string
            subtype_val = None
            if plaid_acc.subtype:
                subtype_val = plaid_acc.subtype.value if hasattr(plaid_acc.subtype, 'value') else str(plaid_acc.subtype)
            
            account, account_created = Account.objects.update_or_create(
                plaid_account_id=plaid_acc.account_id,
                defaults={
                    'user': request.user,
                    'account_name': plaid_acc.name,
                    'mask': plaid_acc.mask,
                    'account_type': our_type,
                    'subtype': subtype_val,
                    'balance': balance_val,
                    'currency': plaid_acc.balances.iso_currency_code or 'USD',
                    'is_active': True,
                }
            )
            created_accounts.append({
                'id': account.id,
                'name': account.account_name,
                'type': account.account_type,
                'created': account_created
            })

        return JsonResponse({
            'item_id': item_id,
            'accounts_created': len(created_accounts),
            'accounts': created_accounts
        })
    except Exception as e:
        import traceback
        print(f"Error in exchange_public_token: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_transactions(request):
    try:
        if not client:
            return JsonResponse({'error': 'Plaid is not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in environment variables.'}, status=500)
        
        user = request.user
        connections = list(PlaidConnection.objects.filter(user=user))
        if not connections:
            return JsonResponse({'error': 'No Plaid connection found. Please connect a bank account first.'}, status=400)

        total_added = 0
        total_modified = 0
        total_removed = 0
        total_fetched = 0
        any_first_sync = False
        first_sync_count = 0
        accounts_not_found = set()
        connection_summaries = []
        cursors = []
        connection_errors = []

        from transactions.models import Transaction
        from accounts.models import Account
        
        for connection in connections:
            # 1. Fetch Transactions
            cursor = connection.next_cursor  # Can be None for first sync
            is_first_sync = cursor is None or cursor == ''
            if is_first_sync:
                first_sync_count += 1
            any_first_sync = any_first_sync or is_first_sync

            added = []
            modified = []
            removed = []
            has_more = True
            page_count = 0

            sync_type = "FIRST SYNC" if is_first_sync else "INCREMENTAL SYNC"
            connection_label = connection.institution_name or connection.item_id
            print(f"[Plaid Sync] Starting {sync_type} for user {user.username} ({connection_label})")
            if not is_first_sync:
                print(f"[Plaid Sync] Using cursor: {cursor[:50] if cursor else 'None'}...")

            try:
                while has_more:
                    page_count += 1
                    # Build request - only include cursor if it exists (not None)
                    request_params = {
                        'access_token': connection.access_token,
                    }
                    # Only add cursor if it's not None/empty
                    if cursor:
                        request_params['cursor'] = cursor
                    
                    request_sync = TransactionsSyncRequest(**request_params)
                    response = client.transactions_sync(request_sync)
                    page_added = response.added or []
                    page_modified = response.modified or []
                    page_removed = response.removed or []
                    
                    added.extend(page_added)
                    modified.extend(page_modified)
                    removed.extend(page_removed)
                    has_more = response.has_more
                    cursor = response.next_cursor
                    
                    print(f"[Plaid Sync] Page {page_count}: {len(page_added)} added, {len(page_modified)} modified, {len(page_removed)} removed")
                
                print(f"[Plaid Sync] Total fetched: {len(added)} added, {len(modified)} modified, {len(removed)} removed")
                total_fetched += len(added) + len(modified) + len(removed)

                # 2. Process Accounts (Update Balances)
                # Fetch latest balance from Plaid to be authoritative
                accounts_response = client.accounts_get(AccountsGetRequest(access_token=connection.access_token))
            except ApiException as e:
                error_payload = {}
                if getattr(e, 'body', None):
                    try:
                        error_payload = json.loads(e.body)
                    except Exception:
                        error_payload = {}
                error_entry = {
                    'item_id': connection.item_id,
                    'institution_id': connection.institution_id,
                    'institution_name': connection.institution_name,
                    'error_code': error_payload.get('error_code'),
                    'error_type': error_payload.get('error_type'),
                    'error_message': error_payload.get('error_message') or str(e),
                }
                connection_errors.append(error_entry)
                print(f"[Plaid Sync] ERROR for {connection_label}: {error_entry['error_code']} - {error_entry['error_message']}")
                continue

            print(f"[Plaid Sync] Found {len(accounts_response.accounts)} accounts from Plaid")
            for plaid_acc in accounts_response.accounts:
                # Map Plaid type to our choices
                type_map = {
                    'depository': 'bank',
                    'credit': 'credit_card',
                    'investment': 'other',
                    'loan': 'other',
                    'brokerage': 'other',
                }
                # Handle both enum objects and strings
                acc_type = plaid_acc.type.value if hasattr(plaid_acc.type, 'value') else str(plaid_acc.type)
                our_type = type_map.get(acc_type, 'other')
                
                # Calculate balance (Available or Current)
                # For credit cards, current positive = debt.
                current = plaid_acc.balances.current
                available = plaid_acc.balances.available
                balance_val = current if current is not None else (available or 0)
                
                # Handle subtype - can be enum or string
                subtype_val = None
                if plaid_acc.subtype:
                    subtype_val = plaid_acc.subtype.value if hasattr(plaid_acc.subtype, 'value') else str(plaid_acc.subtype)
                
                account, created = Account.objects.update_or_create(
                    plaid_account_id=plaid_acc.account_id,
                    defaults={
                        'user': user,
                        'account_name': plaid_acc.name,
                        'mask': plaid_acc.mask,
                        'account_type': our_type,
                        'subtype': subtype_val,
                        'balance': balance_val, # Django DecimalField handles float
                        'currency': plaid_acc.balances.iso_currency_code or 'USD',
                    }
                )
                action = "Created" if created else "Updated"
                print(f"[Plaid Sync] {action} account: {account.account_name} (plaid_account_id: {plaid_acc.account_id}, DB ID: {account.id})")

            # 3. Process Transactions
            count_added = 0
            count_modified = 0
            count_removed = 0
            
            # Process added transactions
            print(f"[Plaid Sync] Processing {len(added)} added transactions...")
            for i, txn in enumerate(added):
                print(f"[Plaid Sync] Processing transaction {i+1}/{len(added)}: {txn.name} (account_id: {txn.account_id})")
                account = Account.objects.filter(plaid_account_id=txn.account_id).first()
                if not account:
                    accounts_not_found.add(txn.account_id)
                    print(f"[Plaid Sync] WARNING: Account not found for plaid_account_id: {txn.account_id}, transaction: {txn.name}")
                    # List all available accounts for debugging
                    all_accounts = Account.objects.filter(user=user).values_list('plaid_account_id', 'account_name')
                    print(f"[Plaid Sync] Available accounts: {list(all_accounts)}")
                    continue
                
                # Plaid amount: positive = expense, negative = refund.
                # Standard: Expense = negative, Income = positive.
                # Plaid sends positive for expense. So we negate it.
                amount = -txn.amount 
                print(f"[Plaid Sync] Found account: {account.account_name} (ID: {account.id}), amount: {amount}")
                
                # Check if transaction already exists using plaid_transaction_id (most reliable)
                existing = None
                txn_id = getattr(txn, 'transaction_id', None)
                if txn_id:
                    existing = Transaction.objects.filter(
                        plaid_transaction_id=txn_id
                    ).first()
                    if existing:
                        print(f"[Plaid Sync] Transaction already exists by plaid_transaction_id: {txn_id}")
                
                # Fallback to matching by account, name, date, amount if no transaction_id
                if not existing:
                    existing = Transaction.objects.filter(
                        account=account,
                        name=txn.name,
                        date=txn.date,
                        amount=amount
                    ).first()
                    if existing:
                        print(f"[Plaid Sync] Transaction already exists by name/date/amount: {txn.name} on {txn.date}")
                
                if not existing:
                    # Handle payment_channel - can be enum or string
                    payment_channel_val = None
                    if txn.payment_channel:
                        payment_channel_val = txn.payment_channel.value if hasattr(txn.payment_channel, 'value') else str(txn.payment_channel)
                    
                    category_val = txn.category[0] if txn.category and len(txn.category) > 0 else 'Uncategorized'
                    
                    print(f"[Plaid Sync] Creating transaction: {txn.name}, amount: {amount}, date: {txn.date}, category: {category_val}")
                    try:
                        Transaction.objects.create(
                            account=account,
                            plaid_transaction_id=txn_id,
                            amount=amount,
                            date=txn.date,
                            name=txn.name,
                            merchant_name=txn.merchant_name,
                            category=category_val,
                            payment_channel=payment_channel_val,
                            pending=txn.pending
                        )
                        count_added += 1
                        print(f"[Plaid Sync] ??? Successfully created transaction {count_added}: {txn.name}")
                        if count_added % 10 == 0:
                            print(f"[Plaid Sync] Created {count_added} transactions so far...")
                    except Exception as create_error:
                        print(f"[Plaid Sync] ??? ERROR creating transaction {txn.name}: {str(create_error)}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"[Plaid Sync] Skipping duplicate transaction: {txn.name}")
            
            # Process modified transactions
            print(f"[Plaid Sync] Processing {len(modified)} modified transactions...")
            for txn in modified:
                account = Account.objects.filter(plaid_account_id=txn.account_id).first()
                if account:
                    amount = -txn.amount
                    
                    # Find existing transaction using plaid_transaction_id (most reliable)
                    existing = None
                    if hasattr(txn, 'transaction_id') and txn.transaction_id:
                        existing = Transaction.objects.filter(
                            plaid_transaction_id=txn.transaction_id
                        ).first()
                    
                    # Fallback to matching by account, name, date
                    if not existing:
                        existing = Transaction.objects.filter(
                            account=account,
                            name=txn.name,
                            date=txn.date
                        ).first()
                    
                    if existing:
                        # Handle payment_channel - can be enum or string
                        payment_channel_val = None
                        if txn.payment_channel:
                            payment_channel_val = txn.payment_channel.value if hasattr(txn.payment_channel, 'value') else str(txn.payment_channel)
                        
                        existing.amount = amount
                        existing.merchant_name = txn.merchant_name
                        existing.category = txn.category[0] if txn.category and len(txn.category) > 0 else 'Uncategorized'
                        existing.payment_channel = payment_channel_val
                        existing.pending = txn.pending
                        # Update plaid_transaction_id if it wasn't set before
                        if not existing.plaid_transaction_id and hasattr(txn, 'transaction_id') and txn.transaction_id:
                            existing.plaid_transaction_id = txn.transaction_id
                        existing.save()
                        count_modified += 1
            
            # Process removed transactions
            print(f"[Plaid Sync] Processing {len(removed)} removed transactions...")
            for removed_txn in removed:
                # Use plaid_transaction_id to reliably identify and remove transactions
                if hasattr(removed_txn, 'transaction_id') and removed_txn.transaction_id:
                    deleted = Transaction.objects.filter(
                        plaid_transaction_id=removed_txn.transaction_id
                    ).delete()
                    if deleted[0] > 0:
                        count_removed += 1
                else:
                    # Fallback: try to find by account_id and other characteristics if available
                    account = Account.objects.filter(plaid_account_id=removed_txn.account_id).first()
                    if account and hasattr(removed_txn, 'name') and hasattr(removed_txn, 'date'):
                        deleted = Transaction.objects.filter(
                            account=account,
                            name=removed_txn.name,
                            date=removed_txn.date
                        ).delete()
                        if deleted[0] > 0:
                            count_removed += 1
                    else:
                        count_removed += 1  # Count it even if we can't remove it

            # Update cursor and last synced timestamp (use timezone-aware datetime)
            connection.next_cursor = cursor
            connection.last_synced_at = timezone.now()
            connection.save()

            total_added += count_added
            total_modified += count_modified
            total_removed += count_removed

            cursors.append({
                'item_id': connection.item_id,
                'institution_id': connection.institution_id,
                'institution_name': connection.institution_name,
                'next_cursor': cursor,
            })

            connection_summaries.append({
                'item_id': connection.item_id,
                'institution_id': connection.institution_id,
                'institution_name': connection.institution_name,
                'is_first_sync': is_first_sync,
                'added': count_added,
                'modified': count_modified,
                'removed': count_removed,
            })

            print(f"[Plaid Sync] Sync complete: {count_added} added, {count_modified} modified, {count_removed} removed")
            
            # If no transactions were found and this is an incremental sync, it's normal
            if is_first_sync and count_added == 0 and len(added) == 0:
                print(f"[Plaid Sync] INFO: First sync returned 0 transactions. This might mean:")
                print(f"[Plaid Sync]   - The Plaid account has no transactions yet")
                print(f"[Plaid Sync]   - Transactions are outside the default date range")
            elif not is_first_sync and count_added == 0:
                print(f"[Plaid Sync] INFO: Incremental sync - no new transactions since last sync")

        if accounts_not_found:
            print(f"[Plaid Sync] WARNING: {len(accounts_not_found)} account(s) not found: {accounts_not_found}")

        status = 'success'
        if connection_errors and len(connection_errors) < len(connections):
            status = 'partial_success'
        elif connection_errors and len(connection_errors) == len(connections):
            status = 'error'

        return JsonResponse({
            'status': status,
            'added': total_added,
            'modified': total_modified,
            'removed': total_removed,
            'cursor': cursors[0]['next_cursor'] if len(cursors) == 1 else None,
            'cursors': cursors if len(cursors) > 1 else None,
            'accounts_not_found': list(accounts_not_found) if accounts_not_found else [],
            'is_first_sync': any_first_sync,
            'first_sync_count': first_sync_count,
            'connection_count': len(connections),
            'total_fetched': total_fetched,
            'connections': connection_summaries,
            'errors': connection_errors,
        })

    except Exception as e:
        import traceback
        print(f"Error in sync_transactions: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_sync(request):
    """
    Reset the sync cursor to trigger a full resync (first sync).
    This will cause the next sync to fetch all transactions from the beginning.
    """
    try:
        user = request.user
        connections = list(PlaidConnection.objects.filter(user=user))

        if not connections:
            return JsonResponse({'error': 'No Plaid connection found. Please connect a bank account first.'}, status=400)
        
        # Reset the cursor to None to trigger first sync
        old_cursors = []
        for connection in connections:
            old_cursors.append({
                'item_id': connection.item_id,
                'institution_id': connection.institution_id,
                'institution_name': connection.institution_name,
                'old_cursor': connection.next_cursor[:50] if connection.next_cursor else None,
            })
            connection.next_cursor = None
            connection.save()
        
        print(f"[Plaid Reset] Reset sync cursor for user {user.username}. Connections: {len(old_cursors)}")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Sync cursor reset. Next sync will be a full resync.',
            'reset_count': len(old_cursors),
            'old_cursors': old_cursors,
        })
    except Exception as e:
        import traceback
        print(f"Error in reset_sync: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({'error': str(e)}, status=500)
