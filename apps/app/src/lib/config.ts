/**
 * Base URL of the Django backend. Set EXPO_PUBLIC_API_URL in `.env.local`:
 * - iOS simulator / web: http://localhost:8000
 * - Android emulator:    http://10.0.2.2:8000
 * - Physical device:     http://<your computer's LAN IP>:8000
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Public address of the web app, used in links people share. Set EXPO_PUBLIC_WEB_URL. */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081';
