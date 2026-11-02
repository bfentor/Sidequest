"""Turning an address or place name into coordinates, for the event form's location search.

Uses OpenStreetMap's Nominatim by default. Its usage policy allows light use
(at most one request a second, with an identifying User-Agent); point
GEOCODER_URL at a self-hosted Nominatim or a compatible service for more.
https://operations.osmfoundation.org/policies/nominatim/
"""

import hashlib
import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_SECONDS = 60 * 60 * 24


def search(query: str, language: str) -> list[dict]:
    """Up to five matches as {"label", "lat", "lng"}; empty if nothing (or the service) answers."""
    query = query.strip()
    if len(query) < 3:
        return []
    digest = hashlib.sha256(query.lower().encode()).hexdigest()
    cache_key = f"geocode:{language}:{digest}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    params = {"q": query, "format": "jsonv2", "limit": 5, "addressdetails": 0}
    if settings.GEOCODER_COUNTRY_CODES:
        params["countrycodes"] = settings.GEOCODER_COUNTRY_CODES
    request = urllib.request.Request(
        f"{settings.GEOCODER_URL}?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": settings.GEOCODER_USER_AGENT, "Accept-Language": language},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            places = json.load(response)
    except (OSError, ValueError):
        logger.warning("Geocoding failed for %r", query, exc_info=True)
        return []

    results = [
        {"label": place["display_name"], "lat": float(place["lat"]), "lng": float(place["lon"])}
        for place in places
    ]
    cache.set(cache_key, results, CACHE_SECONDS)
    return results
