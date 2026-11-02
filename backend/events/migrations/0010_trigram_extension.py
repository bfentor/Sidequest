from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """pg_trgm: typo-tolerant search on event titles and profile names."""

    dependencies = [("events", "0009_event_students_of")]

    operations = [TrigramExtension()]
