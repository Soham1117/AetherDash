from django.urls import path
from . import views

urlpatterns = [
    path('create_link_token/', views.create_link_token, name='create_link_token'),
    path('exchange_public_token/', views.exchange_public_token, name='exchange_public_token'),
    path('sync_transactions/', views.sync_transactions, name='sync_transactions'),
    path('reset_sync/', views.reset_sync, name='reset_sync'),
]
