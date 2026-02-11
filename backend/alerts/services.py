from datetime import timedelta
from django.utils.timezone import now
from .models import Alert, Notification
from accounts.models import Account
from budgets.models import Budget
from transactions.models import Transaction


class AlertService:
    def check_all_conditions(self, user):
        """
        Check all alert conditions for the user and generate notifications.
        Can be called manually or by automated triggers.
        """
        notifications_created = 0
        cooldown_period = timedelta(hours=24)  # Don't alert same rule twice in 24h

        # 1. Check Low Balance
        low_balance_alerts = Alert.objects.filter(
            user=user, alert_type="low_balance", is_active=True
        )
        for alert in low_balance_alerts:
            # Check cooldown
            if (
                alert.last_triggered_at
                and (now() - alert.last_triggered_at) < cooldown_period
            ):
                continue

            if alert.account and alert.account.balance < alert.threshold_value:
                message = (
                    alert.alert_message
                    or f"Balance for {alert.account.account_name} is below ${alert.threshold_value}"
                )
                Notification.objects.create(
                    user=user,
                    alert_rule=alert,
                    title="Low Balance Alert",
                    message=message,
                    related_object_id=alert.account.id,
                    related_object_type="Account",
                )
                alert.last_triggered_at = now()
                alert.save()
                notifications_created += 1

        # 2. Check Large Transactions (past 24h)
        large_txn_alerts = Alert.objects.filter(
            user=user, alert_type="large_transaction", is_active=True
        )
        if large_txn_alerts.exists():
            one_day_ago = now() - timedelta(days=1)
            # Fetch recent transactions
            txns = Transaction.objects.filter(
                account__user=user, date__gte=one_day_ago.date()
            )

            for alert in large_txn_alerts:
                # Check cooldown
                if (
                    alert.last_triggered_at
                    and (now() - alert.last_triggered_at) < cooldown_period
                ):
                    continue

                # Find any transaction > threshold
                max_txn = None
                for t in txns:
                    if abs(t.amount) >= alert.threshold_value:
                        max_txn = t
                        break

                if max_txn:
                    message = (
                        alert.alert_message
                        or f"Large transaction detected: {max_txn.name} for ${abs(max_txn.amount)}"
                    )
                    Notification.objects.create(
                        user=user,
                        alert_rule=alert,
                        title="Large Transaction Alert",
                        message=message,
                        related_object_id=max_txn.id,
                        related_object_type="Transaction",
                    )
                    alert.last_triggered_at = now()
                    alert.save()
                    notifications_created += 1

        # 3. Check Budgets (Budget Exceeded)
        budget_alerts = Alert.objects.filter(
            user=user, alert_type="budget_exceeded", is_active=True
        )
        if budget_alerts.exists():
            budgets = Budget.objects.filter(user=user)
            today = now().date()
            start_of_month = today.replace(day=1)

            # Helper to get spent amount for a budget category
            transactions = Transaction.objects.filter(
                account__user=user,
                date__gte=start_of_month,
                date__lte=today,
                is_transfer=False,  # Exclude internal transfers
            )

            for alert in budget_alerts:
                if (
                    alert.last_triggered_at
                    and (now() - alert.last_triggered_at) < cooldown_period
                ):
                    continue

                # Check all budgets
                for budget in budgets:
                    spent = 0
                    if budget.category_group:
                        cats = budget.category_group.subcategories.all()
                        cat_names = [c.name for c in cats]
                        budget_txns = transactions.filter(category__in=cat_names)
                        spent = sum(abs(t.amount) for t in budget_txns if t.amount < 0)

                    if spent > budget.amount:
                        message = (
                            alert.alert_message
                            or f"Budget '{budget.name}' exceeded! Spent: ${spent}, Limit: ${budget.amount}"
                        )
                        Notification.objects.create(
                            user=user,
                            alert_rule=alert,
                            title="Budget Alert",
                            message=message,
                            related_object_id=budget.id,
                            related_object_type="Budget",
                        )
                        alert.last_triggered_at = now()
                        alert.save()
                        notifications_created += 1
                        break  # Prevent spamming multiple budget alerts

        return {
            "status": "Alert check completed",
            "notifications_created": notifications_created,
        }
