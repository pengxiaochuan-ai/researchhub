import manifest from '../p002/crop-assets.json';

// Keep all account entries on the same content-addressed, pixel-exact artwork.
const url = image => `/pages/p002/${image.src}`;
export const accountImages = Object.freeze({
 logo: url(manifest.crops['1,75,99,66,67']),
 wheel: url(manifest.optimized['hero-wheel-transparent.png']),
 background: url(manifest.optimized['section-background.png']),
});
