import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { PROOF_MAX_BYTES, PROOF_QUALITY, PROOF_SECOND_QUALITY, fitWithin } from '@/student/fees';

// A payment-proof photo, shrunk as the website shrinks it (utils/imageCompress.js):
// fit within 1600 px, JPEG at 0.85, a second pass at 0.7 if it is still over the
// AMS's 500 KB. One owner — the student's proof and reception's proof both use it
// (moved here from the student's ProofScreen, 14 Nov 2026).

export type Photo = { uri: string; width: number; height: number };

export async function shrinkPhoto(p: Photo): Promise<string | { error: string }> {
  const size = fitWithin(p.width, p.height);
  for (const q of [PROOF_QUALITY, PROOF_SECOND_QUALITY]) {
    const ctx = ImageManipulator.manipulate(p.uri);
    if (size.width !== p.width || size.height !== p.height) ctx.resize(size);
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: q, format: SaveFormat.JPEG });
    if (new File(out.uri).size <= PROOF_MAX_BYTES) return out.uri;
  }
  return { error: 'This photo is too large to send even after shrinking. Try a screenshot instead.' };
}
