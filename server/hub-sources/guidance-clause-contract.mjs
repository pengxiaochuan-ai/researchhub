import { readFileSync } from 'node:fs';
import { initialFive } from './initial-five.mjs';
import { registryDetailHash } from './registry-detail-contract.mjs';

const manifest = JSON.parse(readFileSync(new URL('./guidance-clause-manifest.json', import.meta.url), 'utf8'));
export const guidanceHash = registryDetailHash;
export const guidancePayload = key => structuredClone(manifest.find(value => value.externalKey === key) ?? null);
export function validateGuidancePayload(payload, source) {
  const expectedSource = initialFive.find(item => item.mimeType === 'application/pdf' && item.externalKey === source?.externalKey);
  const expectedPayload = guidancePayload(source?.externalKey);
  // Fixed, visually checked excerpts only. This is not an OCR-text passthrough or
  // a frontend seed fallback: a persisted source/extraction must also pass review.
  if (!expectedSource || !expectedPayload || expectedSource.expectedSha256 !== source.expectedSha256 ||
      expectedSource.metadata.pages !== payload?.pageCount || guidanceHash(payload) !== guidanceHash(expectedPayload))
    throw new Error('GUIDANCE_EXTRACTION_REJECTED');
  return payload;
}
