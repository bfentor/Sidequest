# Scheduled jobs

Every job the deployed API needs, to add in Coolify (the API › Scheduled
Tasks). Each runs `python manage.py <command>` in the running API container.
Update this list whenever a feature adds a job.

| Command | Schedule | Why |
|---|---|---|
| `clearsessions` | Daily, `0 4 * * *` | Removes expired sessions (allauth's session tokens are Django sessions). |
| `delete_orphan_images` | Daily, `30 4 * * *` | Deletes uploaded pictures that were never attached to anything, or no longer are. |
