from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from datetime import date, timedelta
from rest_framework.exceptions import ValidationError
from .models import Prediction
from .serializers import PredictionSerializer


class PredictionViewSet(viewsets.ModelViewSet):
    serializer_class = PredictionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_accounts = user.accounts.all()
        predictions = Prediction.objects.filter(account__in=user_accounts)

        filter_type = self.request.query_params.get("type")
        start_date = self.request.query_params.get("start")
        end_date = self.request.query_params.get("end")

        today = date.today()

        if filter_type == "today":
            predictions = predictions.filter(prediction_date=today)
        elif filter_type == "week":
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            predictions = predictions.filter(
                prediction_date__range=[week_start, week_end]
            )
        elif filter_type == "month":
            month_start = today.replace(day=1)
            next_month = month_start + timedelta(days=31)
            month_end = next_month.replace(day=1) - timedelta(days=1)
            predictions = predictions.filter(
                prediction_date__range=[month_start, month_end]
            )
        elif filter_type == "custom":
            if not start_date or not end_date:
                raise ValidationError(
                    {
                        "detail": "Both start and end dates are required for custom filter."
                    }
                )
            predictions = predictions.filter(
                prediction_date__range=[start_date, end_date]
            )

        return predictions

    @action(detail=False, methods=["get"])
    def cashflow(self, request):
        """
        Generate a cash flow forecast for the next N days.
        Query params: days (default 30)
        Returns: projected daily balance based on historical spending patterns and recurring transactions.
        """
        from rest_framework.decorators import action
        from rest_framework.response import Response
        from django.db.models import Sum, Avg
        from transactions.models import Transaction, RecurringTransaction
        from accounts.models import Account

        days = int(request.query_params.get("days", 30))
        user = request.user
        user_accounts = Account.objects.filter(user=user)

        # Current total balance
        current_balance = sum(acc.balance for acc in user_accounts)

        # Historical daily averages from past 90 days
        ninety_days_ago = date.today() - timedelta(days=90)
        transactions = Transaction.objects.filter(
            account__in=user_accounts,
            date__gte=ninety_days_ago,
            is_transfer=False,  # Exclude internal transfers from forecast calculations
        )

        # Calculate average daily income and expenses
        total_credits = (
            transactions.filter(amount__gt=0).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        total_debits = (
            transactions.filter(amount__lt=0).aggregate(total=Sum("amount"))["total"]
            or 0
        )

        avg_daily_income = float(total_credits) / 90
        avg_daily_expense = abs(float(total_debits)) / 90
        avg_daily_net = avg_daily_income - avg_daily_expense

        # Get active recurring transactions
        recurring = RecurringTransaction.objects.filter(user=user, is_active=True)

        # Build forecast
        forecast = []
        running_balance = float(current_balance)

        for day_offset in range(days + 1):
            forecast_date = date.today() + timedelta(days=day_offset)
            daily_recurring = 0

            # Check if any recurring transactions are due on this date
            for rec in recurring:
                if rec.next_due_date == forecast_date:
                    daily_recurring -= float(rec.amount)  # Assume expense

            # Add average daily net flow
            if day_offset > 0:
                running_balance += avg_daily_net + daily_recurring

            forecast.append(
                {
                    "date": str(forecast_date),
                    "projected_balance": round(running_balance, 2),
                    "recurring_due": daily_recurring,
                }
            )

        # Find when balance might go negative
        warning_date = None
        for point in forecast:
            if point["projected_balance"] < 0:
                warning_date = point["date"]
                break

        return Response(
            {
                "current_balance": current_balance,
                "avg_daily_income": round(avg_daily_income, 2),
                "avg_daily_expense": round(avg_daily_expense, 2),
                "forecast": forecast,
                "warning_date": warning_date,
            }
        )


class FinanceAgentView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"])
    def chat(self, request):
        from .agent import FinancialAgent

        query = request.data.get("query")
        if not query:
            return Response({"error": "No query provided"}, status=400)

        try:
            agent = FinancialAgent(request.user)
            result = agent.run(query)
            return Response({"response": result["output"]})
        except Exception as e:
            print(f"Agent Error: {e}")
            return Response({"error": str(e)}, status=500)
