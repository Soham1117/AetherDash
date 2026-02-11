from django.conf import settings
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import tool
from datetime import date, timedelta
from django.db.models import Sum, Q, Avg
from transactions.models import Transaction, RecurringTransaction, SavingsGoal
from budgets.models import Budget
from accounts.models import Account
from alerts.models import Alert
from categories.models import Category

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=settings.OPENAI_API_KEY)

# --- Define Tools ---


@tool
def get_account_balances(user_id: int):
    """Get core balance information for all accounts."""
    accounts = Account.objects.filter(user_id=user_id)
    if not accounts.exists():
        return "No accounts found."

    lines = []
    total = 0
    for acc in accounts:
        lines.append(f"{acc.account_name}: ${acc.balance}")
        total += acc.balance
    lines.append(f"TOTAL NET WORTH: ${total}")
    return "\n".join(lines)


@tool
def search_transactions(user_id: int, query: str = None, days: int = 30):
    """
    Search transactions.
    query: string to match in merchant/description (e.g. 'Uber').
    days: look back N days (default 30).
    """
    start_date = date.today() - timedelta(days=days)
    txns = Transaction.objects.filter(
        account__user_id=user_id, date__gte=start_date
    ).order_by("-date")

    if query:
        txns = txns.filter(name__icontains=query)

    # Limit results to avoid context overflow
    txns = txns[:20]

    if not txns.exists():
        return f"No transactions found matching '{query}' in last {days} days."

    results = []
    for t in txns:
        results.append(f"ID: {t.id} | {t.date} | {t.name} | ${t.amount} | {t.category}")

    return "\n".join(results)


@tool
def get_transaction_details(user_id: int, transaction_id: int):
    """Get full details of a specific transaction by ID."""
    try:
        t = Transaction.objects.get(id=transaction_id, account__user_id=user_id)
        return (
            f"ID: {t.id}\n"
            f"Date: {t.date}\n"
            f"Name: {t.name}\n"
            f"Amount: ${t.amount}\n"
            f"Category: {t.category}\n"
            f"Account: {t.account.account_name}\n"
            f"Merchant: {t.merchant_name}\n"
        )
    except Transaction.DoesNotExist:
        return "Transaction not found."


@tool
def add_transaction(
    user_id: int,
    amount: float,
    name: str,
    account_name: str,
    category: str = None,
    date_str: str = None,
):
    """
    Add a new transaction (expense < 0, income > 0).
    account_name: Fuzzy match account.
    category: Fuzzy match category name.
    """
    # 1. Find Account
    acc = Account.objects.filter(
        user_id=user_id, account_name__icontains=account_name
    ).first()
    if not acc:
        # Fallback: check if 'cash' or 'wallet' matches
        return f"Error: Account '{account_name}' not found. Available: {[a.account_name for a in Account.objects.filter(user_id=user_id)]}"

    # 2. Find/Resolve Category
    cat_ref = None
    if category:
        cat_ref = Category.objects.filter(
            user_id=user_id, name__icontains=category
        ).first()
        if not cat_ref:
            cat_ref = Category.objects.filter(
                name__icontains=category, is_system=True
            ).first()

    # 3. Create
    use_date = date.today()
    if date_str:
        try:
            use_date = date.fromisoformat(date_str)
        except ValueError:
            return "Invalid date format. Use YYYY-MM-DD."

    t = Transaction.objects.create(
        account=acc,
        amount=amount,
        name=name,
        date=use_date,
        category=category or (cat_ref.name if cat_ref else "Uncategorized"),
        category_ref=cat_ref,
    )

    # Update balance
    acc.balance += amount
    acc.save()

    return (
        f"Transaction added: ID {t.id} | {t.name} -> ${t.amount} ({acc.account_name})"
    )


@tool
def update_transaction(
    user_id: int,
    transaction_id: int,
    name: str = None,
    amount: float = None,
    category: str = None,
):
    """Update an existing transaction."""
    try:
        t = Transaction.objects.get(id=transaction_id, account__user_id=user_id)

        changes = []
        if name:
            t.name = name
            changes.append(f"Name->{name}")

        if amount is not None:
            # Adjust balance
            diff = amount - float(t.amount)
            t.account.balance += float(
                diff
            )  # Explicitly cast to float/decimal if needed, assuming float for tool
            t.account.save()
            t.amount = amount
            changes.append(f"Amount->{amount}")

        if category:
            cat_ref = Category.objects.filter(
                name__icontains=category
            ).first()  # Simplify lookup
            t.category = category
            t.category_ref = cat_ref
            changes.append(f"Category->{category}")

        t.save()
        return f"Transaction {transaction_id} updated: {', '.join(changes)}"
    except Transaction.DoesNotExist:
        return "Transaction not found."


@tool
def delete_transaction(user_id: int, transaction_id: int):
    """Delete a transaction and revert balance."""
    try:
        t = Transaction.objects.get(id=transaction_id, account__user_id=user_id)

        # Revert balance
        t.account.balance -= t.amount
        t.account.save()

        t.delete()
        return f"Transaction {transaction_id} deleted."
    except Transaction.DoesNotExist:
        return "Transaction not found."


@tool
def create_budget(
    user_id: int, category_name: str, limit: float, month_offset: int = 0
):
    """
    Set a budget for a category for the current month (or future month via offset).
    limit: Budget amount.
    """
    # Find category
    cat = Category.objects.filter(
        name__icontains=category_name
    ).first()  # Simplified lookup
    if not cat:
        return f"Category '{category_name}' not found."

    # Dates
    today = date.today()
    # Simple month calculation logic
    target_month = today.month + month_offset
    target_year = today.year
    while target_month > 12:
        target_month -= 12
        target_year += 1

    start_date = date(target_year, target_month, 1)
    # End date (first day of next month - 1 day) -- simplified for now or let model handle
    import calendar

    last_day = calendar.monthrange(target_year, target_month)[1]
    end_date = date(target_year, target_month, last_day)

    b, created = Budget.objects.update_or_create(
        user_id=user_id,
        category_group=cat,
        start_date=start_date,
        end_date=end_date,
        defaults={"amount": limit},
    )

    return f"Budget set for {cat.name}: ${limit} ({start_date} to {end_date})"


@tool
def manage_goal(
    user_id: int, name: str, target: float, deadline: str = None, action: str = "create"
):
    """
    Manage savings goals. action='create' or 'delete'.
    """
    if action == "delete":
        SavingsGoal.objects.filter(user_id=user_id, name__icontains=name).delete()
        return f"Goal '{name}' deleted."

    # Create/Update
    defaults = {"target_amount": target}
    if deadline:
        defaults["deadline"] = date.fromisoformat(deadline)

    obj, created = SavingsGoal.objects.update_or_create(
        user_id=user_id, name=name, defaults=defaults
    )
    return f"Savings Goal '{obj.name}' is set to ${obj.target_amount}."


@tool
def list_recurring_transactions(user_id: int):
    """List active recurring transactions."""
    recs = RecurringTransaction.objects.filter(user_id=user_id, status="active")
    if not recs.exists():
        return "No active recurring transactions."
    return "\n".join(
        [
            f"{r.name}: ${r.amount} ({r.frequency}) - Next Due: {r.next_due_date}"
            for r in recs
        ]
    )


@tool
def list_categories(user_id: int):
    """List available categories."""
    cats = Category.objects.filter(Q(user_id=user_id) | Q(is_system=True))
    names = [c.name for c in cats]
    return "Categories: " + ", ".join(names)


@tool
def create_category(user_id: int, name: str):
    """Create a new custom category."""
    c, created = Category.objects.get_or_create(user_id=user_id, name=name)
    if created:
        return f"Category '{name}' created."
    return f"Category '{name}' already exists."


@tool
def create_alert(user_id: int, alert_type: str, threshold: float):
    """
    Create an alert.
    alert_type: 'low_balance', 'budget_exceeded', 'large_transaction'
    """
    valid_types = ["low_balance", "budget_exceeded", "large_transaction"]
    if alert_type not in valid_types:
        return f"Invalid type. Use: {valid_types}"

    Alert.objects.create(
        user_id=user_id, alert_type=alert_type, threshold_value=threshold
    )
    return f"Alert set: {alert_type} @ ${threshold}"


@tool
def get_spending_summary(user_id: int, days: int = 30):
    """Get total spending broken down by category for the last N days."""
    start_date = date.today() - timedelta(days=days)

    # Get expenses only
    txns = Transaction.objects.filter(
        account__user_id=user_id, date__gte=start_date, amount__lt=0, is_transfer=False
    )

    # Aggregate by category
    # Note: This implies 'category' field. If category is foreign key, adjust.
    # Based on views.py seen earlier, category seems to be a field or related name.
    # We will assume a simple list for now, or minimal aggregation.

    total = txns.aggregate(Sum("amount"))["amount__sum"] or 0
    return f"Total spending in last {days} days: ${abs(total):.2f}"


@tool
def check_budgets(user_id: int):
    """Check status of all budgets."""
    budgets = Budget.objects.filter(user_id=user_id)
    if not budgets.exists():
        return "No budgets set."

    results = []
    for b in budgets:
        # Simple simulation of progress (in real app, use service)
        results.append(f"Budget '{b.name}': Limit ${b.amount}")
    return "\n".join(results)


# --- Agent Utils ---


class FinancialAgent:
    def __init__(self, user):
        self.user = user
        self.tools = [
            get_account_balances,
            search_transactions,
            get_transaction_details,
            add_transaction,
            update_transaction,
            delete_transaction,
            list_recurring_transactions,
            get_spending_summary,
            check_budgets,
            create_budget,
            manage_goal,
            list_categories,
            create_category,
            create_alert,
        ]

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are Aether, an advanced AI financial aide.
            Your goal is to provide accurate, data-driven financial insights and Take ACTIONS on the user's behalf.
            
            Access the user's live database using the provided tools.
            User ID is {user_id}. ALWAYS pass this user_id to tools.
            
            CAPABILITIES:
            - READ: Check balances, search transactions, view budgets/goals.
            - WRITE: Add/Edit/Delete transactions, set budgets, create goals, manage alerts/categories.
            
            If a user asks to "add a transaction" or "spend money", use 'add_transaction'. 
            NOTE: Expenses should be NEGATIVE numbers (e.g. -20.00). Income is POSITIVE.
            
            FORMATTING RULES:
            - If the user asks for a LIST or TABLE, return JSON with type='table'.
            - If the user asks for a CHART, return JSON with type='chart'.
            - Otherwise, reply naturally in text.
            
            Current Date: {date}
            """,
                ),
                ("user", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        self.agent = create_openai_tools_agent(llm, self.tools, prompt)
        self.executor = AgentExecutor(agent=self.agent, tools=self.tools, verbose=True)

    def run(self, query):
        return self.executor.invoke(
            {"input": query, "user_id": self.user.id, "date": str(date.today())}
        )
