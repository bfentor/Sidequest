// Serves the web build exported by `expo export --platform web` (apps/app/dist):
// static files from dist/client, everything else rendered by Expo Router's
// server build in dist/server.
//
// CommonJS on purpose: expo-server's ESM build can't be loaded by Node directly.
const path = require('node:path');

const express = require('express');
const { createRequestHandler } = require('expo-server/adapter/express');

const dist = process.env.EXPO_DIST_DIR ?? path.resolve(__dirname, '../app/dist');
const port = Number(process.env.PORT ?? 3000);

const app = express();
app.disable('x-powered-by');

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// Bundles have content hashes in their names, so they can be cached for good.
app.use(
  '/_expo/static',
  express.static(path.join(dist, 'client/_expo/static'), { immutable: true, maxAge: '1y' }),
);
app.use(express.static(path.join(dist, 'client'), { maxAge: '1h', redirect: false }));

app.use(createRequestHandler({ build: path.join(dist, 'server') }));

app.listen(port, () => {
  console.log(`Sidequest web listening on port ${port}`);
});
