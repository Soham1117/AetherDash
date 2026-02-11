from rest_framework import viewsets, permissions
from .models import Category
from rest_framework import serializers

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return system categories + user's own categories
        from django.db.models import Q
        return Category.objects.filter(
            Q(is_system=True) | Q(user=self.request.user)
        )
