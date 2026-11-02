#!/bin/sh
#
# What the container does before starting the API. Only the web process
# (gunicorn) migrates: Coolify's scheduled tasks run their commands in the
# running container, not through here.
#
# While a deploy switches over, the previous release still serves with the
# migrated database, so migrations must not break it (DEPLOYMENT.md).
set -e

if [ "$1" = "gunicorn" ]; then
    # If this fails, the container stops and the previous release keeps serving.
    python manage.py migrate --noinput
    # Only acts when CACHE_URL points at a database cache.
    python manage.py createcachetable
fi

exec "$@"
