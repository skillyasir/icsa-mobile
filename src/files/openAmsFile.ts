// Opening a file the AMS keeps behind sign-in (a submitted assignment, a
// payment proof): downloaded with the person's own access token into this
// phone's cache, then shown with the system viewer (Quick Look on iPhone, the
// default app on Android), or offered to another app when there is none.
//
// The AMS decides who may fetch a file (protectedUploads); the app sends the
// token and nothing else. The cached copy is replaced on every open.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ams } from '@/api/client';
import { AMS_WEB_URL } from '@/config';

/** Opens the file, or answers why it could not, in the person's words. */
export async function openAmsFile(url: string, name: string): Promise<string | null> {
  const tok = await ams.token();
  if (!tok.ok) return tok.failure.message;
  const abs = /^https?:\/\//.test(url) ? url : AMS_WEB_URL + (url.startsWith('/') ? url : '/' + url);
  const safe = (name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'file';
  const dest = new File(Paths.cache, safe);
  try {
    if (dest.exists) dest.delete();
  } catch {
    // an old copy that cannot be removed is overwritten below
  }
  let file: File;
  try {
    file = await File.downloadFileAsync(abs, dest, { headers: { Authorization: `Bearer ${tok.value}` }, idempotent: true });
  } catch (err) {
    console.warn('[file] download failed:', err instanceof Error ? err.message : String(err));
    return 'The file could not be downloaded. Check your connection and try again.';
  }
  try {
    if (await File.canPreview(file)) {
      await File.preview(file);
      return null;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
      return null;
    }
    return 'This phone has no app that opens this kind of file.';
  } catch (err) {
    console.warn('[file] could not open:', err instanceof Error ? err.message : String(err));
    return 'This phone could not open the file.';
  }
}
