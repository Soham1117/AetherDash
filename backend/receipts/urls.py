from django.urls import path
from . import views

urlpatterns = [
    path("process/", views.process_receipt, name="process_receipt"),
    path("", views.receipt_list_create, name="receipt_list_create"),
    path("save/", views.save_receipt, name="receipt_save"),
    path("images/<str:filename>/", views.receipt_image, name="receipt_image"),
    path("<int:receipt_id>/", views.receipt_detail, name="receipt_detail"),
    path("<int:receipt_id>/process/", views.process_receipt_by_id, name="receipt_process"),
    path("<int:receipt_id>/status/", views.receipt_status, name="receipt_status"),
    path("<int:receipt_id>/items/", views.receipt_items, name="receipt_items"),
    path("<int:receipt_id>/items/<int:item_id>/", views.receipt_item_detail, name="receipt_item_detail"),
]
