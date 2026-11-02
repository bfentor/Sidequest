from django.db import migrations


def name_site(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        pk=1, defaults={"name": "Sidequest", "domain": "sidequest.fentorweb.hu"}
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_user_birth_date_user_terms_accepted_at_and_more"),
        ("sites", "0002_alter_domain_unique"),
    ]

    operations = [migrations.RunPython(name_site, migrations.RunPython.noop)]
