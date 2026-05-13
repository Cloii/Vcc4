import { getPanoramas } from "./api";

// Singleton — tracks what's already been preloaded so we never double-fetch
const preloaded = new Set<string>();
let preloadStarted = false;

/**
 * Silently downloads all panorama images in the background.
 * Safe to call from multiple pages — only runs once per browser session.
 */
export const preloadAllPanoramas = async (): Promise<void> => {
  if (preloadStarted) return;
  preloadStarted = true;

  try {
    const panoramas = await getPanoramas(); // fetch all, no buildingId filter
    panoramas.forEach((pano) => {
      if (!pano.imageUrl || preloaded.has(pano.imageUrl)) return;
      preloaded.add(pano.imageUrl);

      // Use Image() so the browser caches it — zero impact on UI thread
      const img = new Image();
      img.src = pano.imageUrl;
    });
  } catch {
    // Silently fail — preloading is best-effort
    preloadStarted = false; // allow retry next time
  }
};

/**
 * Preload a specific building's panoramas only.
 * Call this when hovering a building card on the Tours page.
 */
export const preloadBuildingPanoramas = async (buildingId: string): Promise<void> => {
  try {
    const panoramas = await getPanoramas(buildingId);
    panoramas.forEach((pano) => {
      if (!pano.imageUrl || preloaded.has(pano.imageUrl)) return;
      preloaded.add(pano.imageUrl);
      const img = new Image();
      img.src = pano.imageUrl;
    });
  } catch {
    // Silently fail
  }
};