from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0015_transactionevidence_transactionextracteditem'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='transfer_override',
            field=models.BooleanField(default=False),
        ),
    ]
