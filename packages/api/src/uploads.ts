import { client } from './generated/client.gen';
import type { Image } from './generated/types.gen';

/** A file on the device, the way React Native's fetch uploads it. */
export type NativeFile = { uri: string; name: string; type: string };

export type UploadResult = { status: 'ok'; image: Image } | { status: 'error'; message?: string };

/**
 * Uploads a picture (a Blob/File on the web, a NativeFile on iOS/Android).
 * Attach it afterwards by its id, e.g. `avatar_id` on the profile.
 *
 * Written by hand because the generated SDK would JSON-encode React Native's
 * file objects instead of streaming the file.
 */
export async function uploadImage(file: Blob | NativeFile): Promise<UploadResult> {
  const form = new FormData();
  // React Native's FormData accepts { uri, name, type } in place of a Blob.
  form.append('file', file as Blob);

  const { data, error } = await client.post<{ 201: Image }, Record<number, Record<string, string[]>>>({
    url: '/api/images/',
    body: form,
    bodySerializer: null,
    // Let fetch set multipart/form-data with its boundary.
    headers: { 'Content-Type': null },
    security: [{ name: 'X-Session-Token', type: 'apiKey' }],
  });
  if (data) {
    return { status: 'ok', image: data };
  }
  return { status: 'error', message: error?.file?.[0] };
}
