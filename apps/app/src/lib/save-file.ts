import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Saves text as a file: on phones by writing it and opening the share sheet. */
export async function saveTextFile(filename: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}
