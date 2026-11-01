import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../backend/openapi.yaml',
  output: 'src/generated',
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk', '@tanstack/react-query'],
});
