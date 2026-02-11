from .models import Budget
from .serializers import BudgetSerializer
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from datetime import date, timedelta
from rest_framework.exceptions import ValidationError


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def progress(self, request):
        today = date.today()
        # Get budgets active for the current month/period? Or all budgets requested?
        # Let's filter by the 'month' query param or default to current month for the progress view
        
        # Simplified: Get all budgets that appear to be for the current month
        # In a real app, 'Budget' usually represents a recurring goal or a specific month's entry.
        # Given our model has start/end date, let's find budgets that overlap with "today" or specific query.
        
        qs = self.get_queryset()
        
        # Optional date filtering
        start_param = request.query_params.get('start')
        end_param = request.query_params.get('end')
        
        if start_param and end_param:
            qs = qs.filter(start_date__gte=start_param, end_date__lte=end_param)
        else:
            # Default to active budgets (active today)
            qs = qs.filter(start_date__lte=today, end_date__gte=today)

        data = []
        from transactions.models import Transaction
        from django.db.models import Sum

        for budget in qs:
            # Find all transactions in this category (and ideally subcategories)
            # For MVP: Direct match on category_ref
            # TODO: Add hierarchical roll-up

            spent = Transaction.objects.filter(
                account__user=request.user,
                category_ref=budget.category_group,
                date__gte=budget.start_date,
                date__lte=budget.end_date,
                amount__lt=0,  # Expenses are negative amounts
                is_transfer=False  # Exclude internal transfers
            ).aggregate(total=Sum('amount'))['total'] or 0

            # Amount is negative for expenses, so convert to positive for display
            spent = abs(spent)
            
            data.append({
                'id': budget.id,
                'category': budget.category_group.name,
                'category_icon': budget.category_group.icon,
                'category_color': budget.category_group.color,
                'budgeted': budget.amount,
                'spent': spent,
                'remaining': budget.amount - spent,
                'percentage': min(round((float(spent) / float(budget.amount)) * 100, 1), 100) if budget.amount > 0 else 100
            })
        
        return Response(data)
