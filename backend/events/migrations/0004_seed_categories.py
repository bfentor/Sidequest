from django.db import migrations

# slug, English, Finnish, Swedish, Material Symbol
CATEGORIES = [
    ("party", "Parties", "Bileet", "Fester", "celebration"),
    ("music", "Music", "Musiikki", "Musik", "music_note"),
    ("sports", "Sports", "Urheilu", "Sport", "sports_soccer"),
    ("outdoors", "Outdoors", "Ulkoilu", "Friluftsliv", "hiking"),
    ("academic", "Academic", "Opiskelu", "Studier", "school"),
    ("career", "Career", "Ura", "Karriär", "work"),
    ("tech", "Tech", "Teknologia", "Teknik", "memory"),
    ("culture", "Culture & arts", "Kulttuuri ja taide", "Kultur och konst", "theater_comedy"),
    ("food", "Food & drink", "Ruoka ja juoma", "Mat och dryck", "restaurant"),
    ("games", "Games", "Pelit", "Spel", "sports_esports"),
    ("wellbeing", "Wellbeing", "Hyvinvointi", "Välmående", "self_improvement"),
    ("volunteering", "Volunteering", "Vapaaehtoistyö", "Volontärarbete", "volunteer_activism"),
    ("community", "Community", "Yhteisö", "Gemenskap", "groups"),
]


def seed(apps, schema_editor):
    Category = apps.get_model("events", "Category")
    for position, (slug, en, fi, sv, icon) in enumerate(CATEGORIES):
        Category.objects.update_or_create(
            slug=slug,
            defaults={"name_en": en, "name_fi": fi, "name_sv": sv, "icon": icon, "position": position},
        )


def unseed(apps, schema_editor):
    apps.get_model("events", "Category").objects.filter(
        slug__in=[slug for slug, *_ in CATEGORIES]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("events", "0003_category_event_categories")]

    operations = [migrations.RunPython(seed, unseed)]
