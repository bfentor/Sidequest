import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';

/**
 * Runs before the first paint. The server renders the light theme (it can't know the visitor's
 * choice), so when the page should be dark it gets a dark background and its content stays
 * hidden until the app has drawn it dark (components/theme-ready.web.tsx), or 3 seconds pass.
 * The key is where lib/appearance.ts keeps the choice.
 */
const THEME_SCRIPT = `(function () {
  try {
    var chosen = localStorage.getItem('sidequest.appearance');
    var dark = chosen === 'dark' || (chosen !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (!dark) return;
    var root = document.documentElement;
    root.dataset.scheme = 'dark';
    root.style.backgroundColor = '${Colors.dark.background}';
    root.setAttribute('data-theme-pending', '');
    setTimeout(function () { root.removeAttribute('data-theme-pending'); }, 3000);
  } catch (error) {}
})();`;

/**
 * The HTML around every web page (server-rendered; not used on phones).
 * Expo's default, plus what makes the site installable as an app and opens in the right color scheme.
 */
export default function Root({ children }: PropsWithChildren) {
  // Each page's metadata and the app's scripts; leaving them out breaks link previews and hydration.
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#208AEF" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Sidequest" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style>{'html[data-theme-pending] #root { visibility: hidden; }'}</style>
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
