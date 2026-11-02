# Scheduled jobs

Every job the deployed API needs, to add in Coolify (the API › Scheduled
Tasks). Each runs `python manage.py <command>` in the running API container.
Update this list whenever a feature adds a job.

| Command | Schedule | Why |
|---|---|---|
| `publish_scheduled_events` | Every minute, `* * * * *` | Announces events scheduled to publish later (their post and follower notifications). |
| `send_event_reminders` | Every 5 minutes, `*/5 * * * *` | Reminds people going or interested two hours before an event starts. |
| `send_push_notifications` | Every minute, `* * * * *` | Pushes new inbox notifications to phones. Without it, notifications only appear in the app's inbox. |
| `clearsessions` | Daily, `0 4 * * *` | Removes expired sessions (allauth's session tokens are Django sessions). |
| `delete_orphan_images` | Daily, `30 4 * * *` | Deletes uploaded pictures that were never attached to anything, or no longer are. |
