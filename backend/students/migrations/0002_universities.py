from django.db import migrations

# Finnish universities and their email domains (staff and student addresses;
# subdomains such as student.lut.fi match too). Admins can correct and extend these.
UNIVERSITIES = [
    ("LUT University", "LUT", "lut.fi"),
    ("Aalto University", "Aalto", "aalto.fi"),
    ("University of Helsinki", "Helsinki", "helsinki.fi"),
    ("Tampere University", "Tampere", "tuni.fi"),
    ("University of Turku", "Turku", "utu.fi"),
    ("University of Oulu", "Oulu", "oulu.fi"),
    ("University of Jyväskylä", "Jyväskylä", "jyu.fi"),
    ("University of Eastern Finland", "UEF", "uef.fi"),
    ("Åbo Akademi University", "Åbo Akademi", "abo.fi"),
    ("University of Vaasa", "Vaasa", "uwasa.fi"),
    ("Hanken School of Economics", "Hanken", "hanken.fi"),
    ("University of Lapland", "Lapland", "ulapland.fi"),
    ("University of the Arts Helsinki", "Uniarts", "uniarts.fi"),
]


def seed(apps, schema_editor):
    University = apps.get_model("students", "University")
    for name, short_name, domains in UNIVERSITIES:
        University.objects.update_or_create(
            name=name, defaults={"short_name": short_name, "email_domains": domains}
        )


class Migration(migrations.Migration):
    dependencies = [("students", "0001_initial")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
