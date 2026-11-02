import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../backend/openapi.yaml',
  output: {
    path: 'src/generated',
    // Overwrite in place instead of deleting the folder first, so a running
    // Metro dev server keeps seeing the files. The set of generated files only
    // changes with a Hey API upgrade; delete the folder by hand then.
    clean: false,
  },
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk', '@tanstack/react-query'],
});
