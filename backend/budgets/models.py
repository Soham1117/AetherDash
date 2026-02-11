from django.db import models
from django.conf import settings
from categories.models import Category

class Budget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets', null=True)
    category_group = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='budgets', null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    
    # We can calculate percentage on the fly, no need to store it unless caching
    
    class Meta:
        unique_together = ('user', 'category_group', 'start_date', 'end_date')

    def __str__(self):
        return f"{self.category_group.name} budget ({self.start_date} - {self.end_date})"
