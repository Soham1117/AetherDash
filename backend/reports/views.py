from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from transactions.models import Transaction
from datetime import datetime, timedelta
from django.utils.timezone import now

class CashFlowSankeyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Date filtering
        today = now().date()
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            # Default to first day of current month
            start_date = today.replace(day=1)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = today

        # Fetch transactions
        transactions = Transaction.objects.filter(
            account__user=request.user,
            date__gte=start_date,
            date__lte=end_date,
            is_transfer=False # Exclude internal transfers
        )

        # Aggregate Income
        total_income = transactions.filter(amount__gt=0).aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Aggregate Expenses by Category
        expenses = transactions.filter(amount__lt=0).values('category').annotate(total=Sum('amount'))
        
        total_expenses = 0
        nodes = [{"id": "Income", "nodeColor": "hsl(145, 60%, 45%)"}]
        links = []

        # Process Expenses
        for exp in expenses:
            category = exp['category'] or "Uncategorized"
            amount = abs(exp['total'])
            total_expenses += amount
            
            # Add node if not exists (simple check, or use set)
            if not any(n['id'] == category for n in nodes):
                nodes.append({"id": category})
            
            # Link Income -> Category
            links.append({
                "source": "Income",
                "target": category,
                "value": float(amount)
            })

        # Calculate Savings (Income - Expenses)
        savings = float(total_income) - float(total_expenses)
        if savings > 0:
            nodes.append({"id": "Savings", "nodeColor": "hsl(200, 60%, 45%)"})
            links.append({
                "source": "Income",
                "target": "Savings",
                "value": savings
            })
        
        # If expenses > income, we have a deficit. 
        # A standard Sankey usually flows L->R. 
        # Ideally, we'd show "Assets" -> "Income" + "Deficit" -> "Expenses" but let's keep it simple.
        # If deficit, Income node value is just Total Income, and we only show links up to that amount?
        # Or we represent Deficit as another source?
        # For simplicity v1: Source is "Budget/Income". If expenses > income, source = total expenses.
        
        return Response({
            "nodes": nodes,
            "links": links,
            "meta": {
                "total_income": total_income,
                "total_expenses": total_expenses,
                "savings": savings,
                "period": f"{start_date} to {end_date}"
            }
        })