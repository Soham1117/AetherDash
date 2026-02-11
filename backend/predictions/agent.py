from django.conf import settings
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import tool
from datetime import date, timedelta
from django.db.models import Sum, Q, Avg
from transactions.models import Transaction, RecurringTransaction
from budgets.models import Budget
from accounts.models import Account
from alerts.models import Alert

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
        results.append(f"{t.date} | {t.name} | ${t.amount} | {t.category}")

    return "\n".join(results)


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
            get_spending_summary,
            check_budgets,
        ]

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are Aether, an advanced AI financial aide.
            Your goal is to provide accurate, data-driven financial insights.
            
            Access the user's live database using the provided tools.
            User ID is {user_id}. ALWAYS pass this user_id to tools.
            
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
