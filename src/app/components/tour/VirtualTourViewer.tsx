import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Viewer } from "@photo-sphere-viewer/core";
import { Viewer as PsvViewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { GalleryPlugin } from "@photo-sphere-viewer/gallery-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import {
  exitDocumentFullscreen,
  exitPseudoFullscreen,
  isPseudoFullscreen,
  toggleTourImmersive,
} from "../../lib/domFullscreen";
import { isLowEndDevice } from "../../pages/TourDetail";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/gallery-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";

// ── BLOB CACHE ─────────────────────────────────────────────────────────────
// Fetches each panorama image once, converts it to a local blob: URL, and
// stores it here. PSV then loads from memory instead of re-fetching Supabase.
// Blob URLs persist for the lifetime of the page session.
const blobCache = new Map<string, string>(); // original URL → blob: URL
const inflight = new Map<string, Promise<string>>(); // prevent duplicate fetches

async function preloadAsBlob(url: string): Promise<string> {
  if (blobCache.has(url)) return blobCache.get(url)!;
  if (inflight.has(url)) return inflight.get(url)!;

  const promise = fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      blobCache.set(url, objectUrl);
      inflight.delete(url);
      return objectUrl;
    })
    .catch(() => {
      inflight.delete(url);
      return url; // fallback to original URL on fetch error
    });

  inflight.set(url, promise);
  return promise;
}
// ──────────────────────────────────────────────────────────────────────────

type PanoHotspot = {
  x: number;
  y: number;
  label: string;
  targetPanoId: string;
  yawDeg?: number;
  pitchDeg?: number;
};

type TourPano = {
  id: string;
  name: string;
  imageUrl: string;
  hotspots?: PanoHotspot[];
  panoData?: { poseHeading?: number };
};

type VirtualTourViewerProps = {
  buildingName: string;
  lng: number;
  lat: number;
  panoramas: TourPano[];
  activePanoId?: string;
  startPanoId?: string;
  strictHotspotLinks?: boolean;
  onExternalHotspotTarget?: (targetPanoId: string) => void;
  onNodeChange?: (panoId: string) => void;
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

const resolveUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

// Returns the blob: URL if already cached, otherwise the original resolved URL.
const resolveWithCache = (url: string): string => {
  const resolved = resolveUrl(url);
  return blobCache.get(resolved) ?? resolved;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const offsetGps = (
  lng: number,
  lat: number,
  idx: number,
  total: number,
): [number, number, number] => {
  const t = (idx / Math.max(1, total)) * Math.PI * 2;
  const meters = 1.2 + idx * 0.35;
  const dLat = (meters * Math.cos(t)) / 111_320;
  const dLng = (meters * Math.sin(t)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat, 2 + (idx % 5)];
};

function buildNodes(
  panoramas: TourPano[],
  buildingName: string,
  lng: number,
  lat: number,
  strictHotspotLinks: boolean,
): { nodes: any[]; markersByPanoId: Map<string, any[]> } {
  const total = panoramas.length;
  const markersByPanoId = new Map<string, any[]>();

  const nodes = panoramas.map((p, idx) => {
    const gps = offsetGps(lng, lat, idx, total);

    const hotspotMarkers = (p.hotspots ?? []).map((hs, i) => {
      const yawDeg = hs.yawDeg ?? ((hs.x ?? 0) / 100) * 360;
      const pitchDeg = hs.pitchDeg ?? (30 - clamp(hs.y ?? 50, 0, 100) * 0.6);
      return {
        id: `hs-${p.id}-${i}`,
        position: { yaw: `${yawDeg}deg`, pitch: `${pitchDeg}deg` },
        html: `
          <button
            type="button"
            id="hs-btn-${p.id}-${i}"
            name="hs-btn-${p.id}-${i}"
            style="width:44px;height:44px;border-radius:999px;border:4px solid #fff;
                   background:#facc15;box-shadow:0 10px 25px rgba(0,0,0,0.35);
                   display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <span style="font-size:14px;color:#1e3a8a;font-weight:900;">↗</span>
          </button>
        `,
        anchor: "center center" as const,
        tooltip: hs.label ? { content: hs.label, position: "top center" as const } : undefined,
        data: { targetPanoId: hs.targetPanoId },
      };
    });
    markersByPanoId.set(p.id, hotspotMarkers);

    const links: any[] = [];
    const hsTargets = [
      ...new Set((p.hotspots ?? []).map((h) => h.targetPanoId).filter(Boolean)),
    ];

    if (hsTargets.length > 0) {
      for (const tid of hsTargets) {
        const tIdx = panoramas.findIndex((x) => x.id === tid);
        if (tIdx !== -1) links.push({ nodeId: tid, gps: offsetGps(lng, lat, tIdx, total) });
      }
    } else if (!strictHotspotLinks && total > 1) {
      const nextIdx = (idx + 1) % total;
      const prevIdx = (idx - 1 + total) % total;
      links.push({ nodeId: panoramas[nextIdx].id, gps: offsetGps(lng, lat, nextIdx, total) });
      if (total > 2) {
        links.push({ nodeId: panoramas[prevIdx].id, gps: offsetGps(lng, lat, prevIdx, total) });
      }
    }

    return {
      id: p.id,
      name: p.name,
      // Use blob: URL if cached — PSV sees a local resource with zero latency.
      panorama: resolveWithCache(p.imageUrl),
      thumbnail: resolveWithCache(p.imageUrl),
      caption: `${buildingName} · ${p.name}`,
      gps,
      panoData:
        p.panoData?.poseHeading != null ? { poseHeading: p.panoData.poseHeading } : undefined,
      links,
      markers: hotspotMarkers,
    };
  });

  return { nodes, markersByPanoId };
}

export const VirtualTourViewer: React.FC<VirtualTourViewerProps> = ({
  buildingName,
  lng,
  lat,
  panoramas,
  activePanoId,
  startPanoId,
  strictHotspotLinks = false,
  onExternalHotspotTarget,
  onNodeChange,
}) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const onNodeChangeRef = useRef(onNodeChange);
  useEffect(() => { onNodeChangeRef.current = onNodeChange; }, [onNodeChange]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // True once the first panorama blob is ready — viewer won't init until then
  // so PSV never shows "Loading panorama…" on the very first node.
  const [cacheReady, setCacheReady] = useState(false);

  const startId = useMemo(
    () =>
      (startPanoId && panoramas.some((p) => p.id === startPanoId) ? startPanoId : undefined) ??
      panoramas[0]?.id,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startPanoId, panoramas[0]?.id],
  );

  const serialized = useMemo(
    () => panoramas.map((p) => `${p.id}|${p.name}|${p.imageUrl}`).join(";;"),
    [panoramas],
  );

  // ── BLOB PRELOAD ─────────────────────────────────────────────────────────
  // 1. Fetch the start panorama eagerly — viewer initialises the moment it lands.
  // 2. Fetch remaining panoramas in the background staggered 400 ms apart so
  //    they don't compete with the active pano download.
  // 3. After each background blob lands, patch the PSV node so future switches
  //    use the blob URL with zero network round-trip.
  useEffect(() => {
    if (panoramas.length === 0) return;

    // Determine which pano the user will see first.
    const startPano = panoramas.find((p) => p.id === startId) ?? panoramas[0];
    const startUrl = resolveUrl(startPano.imageUrl);

    // Eager fetch of the first panorama.
    preloadAsBlob(startUrl).then(() => {
      setCacheReady(true);
    });

    // Background fetch for all other panoramas.
    panoramas.forEach((pano, i) => {
      const url = resolveUrl(pano.imageUrl);
      if (url === startUrl) return; // already being fetched eagerly
      setTimeout(() => {
        preloadAsBlob(url).then((blobUrl) => {
          // Patch the live PSV node to use the blob URL.
          const viewer = viewerRef.current;
          if (!viewer) return;
          const vt = viewer.getPlugin(VirtualTourPlugin);
          if (!vt) return;
          try {
            (vt as any).updateNode?.(pano.id, { panorama: blobUrl, thumbnail: blobUrl });
          } catch {
            // updateNode unavailable — next setNodes call will use blob URLs.
          }
        });
      }, i * 400);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, startId]);

  const resizeViewer = () => {
    const v = viewerRef.current;
    if (!v) return;
    v.resize();
    requestAnimationFrame(() => v.resize());
    setTimeout(() => v.resize(), 50);
    setTimeout(() => v.resize(), 250);
  };

  const syncFullscreenState = () => {
    const el = shellRef.current;
    setIsFullscreen(
      (!!el && isPseudoFullscreen(el)) || !!document.fullscreenElement,
    );
  };

  const handleFullscreenToggle = () => {
    const el = shellRef.current;
    if (!el) return;
    void toggleTourImmersive(el, () => {
      resizeViewer();
      syncFullscreenState();
    }).then(() => {
      resizeViewer();
      syncFullscreenState();
    });
  };

  // ── INIT ─────────────────────────────────────────────────────────────────
  // Waits for cacheReady so the first panorama is already a local blob URL
  // when PSV initialises — eliminating the "Loading panorama…" spinner entirely.
  useEffect(() => {
    if (!containerRef.current || viewerRef.current || !cacheReady) return;

    const viewer = new PsvViewer({
      container: containerRef.current,
      loadingTxt: "",   // suppress spinner text
      loadingImg: "",   // suppress spinner image/circle — blob loads are instant
      touchmoveTwoFingers: false,
      mousewheelCtrlKey: true,
      defaultYaw: "130deg",
      defaultZoomLvl: 50,
      navbar: ["zoom", "move", "gallery", "caption"],
      plugins: [
        MarkersPlugin,
        [GalleryPlugin, { thumbnailSize: { width: 100, height: 100 } }],
        [
          VirtualTourPlugin,
          {
            dataMode: "client",
            positionMode: "gps",
            // Fall back to CSS sphere on low-end devices — no WebGL overhead.
            renderMode: isLowEndDevice() ? "2d" : "3d",
            // PSV also keeps 2 adjacent nodes warm in its own internal cache.
            preload: 2,
            // Short crossfade — feels snappy while still being smooth.
            transitionDuration: 500,
            showLinkTooltip: true,
          },
        ],
      ],
    });

    viewerRef.current = viewer;

    const vt = viewer.getPlugin(VirtualTourPlugin);

    const onNodeChanged = (e: any) => {
      const id = e?.node?.id;
      if (typeof id === "string") onNodeChangeRef.current?.(id);
    };
    vt.addEventListener("node-changed", onNodeChanged as any);

    const onFsChange = () => { resizeViewer(); syncFullscreenState(); };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);

    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = shellRef.current;
      if (!el || !isPseudoFullscreen(el)) return;
      exitPseudoFullscreen(el);
      resizeViewer();
      setIsFullscreen(false);
    };
    window.addEventListener("keydown", onEsc);

    return () => {
      try {
        const v = viewerRef.current;
        if (v) {
          const el = shellRef.current;
          if (el && isPseudoFullscreen(el)) exitPseudoFullscreen(el);
          void exitDocumentFullscreen();
          vt.removeEventListener("node-changed", onNodeChanged as any);
        }
        viewer.destroy();
      } finally {
        document.removeEventListener("fullscreenchange", onFsChange);
        document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
        window.removeEventListener("keydown", onEsc);
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheReady]);

  // ── NODES ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const vt = viewer.getPlugin(VirtualTourPlugin);
    const markers = viewer.getPlugin(MarkersPlugin);
    if (!vt) return;

    // buildNodes calls resolveWithCache — uses blob URLs for any already-fetched panos.
    const { nodes, markersByPanoId } = buildNodes(
      panoramas, buildingName, lng, lat, strictHotspotLinks,
    );

    vt.setNodes(nodes, startId);

    const syncMarkers = (panoId?: string) => {
      if (!markers) return;
      const list = markersByPanoId.get(panoId ?? "") ?? [];
      try { (markers as any).setMarkers(list); }
      catch {
        (markers as any).clearMarkers?.();
        list.forEach((m: any) => (markers as any).addMarker?.(m));
      }
    };
    syncMarkers(startId);

    const onNodeChangedMarkers = (e: any) => {
      const id = e?.node?.id;
      if (typeof id === "string") syncMarkers(id);
    };
    vt.addEventListener("node-changed", onNodeChangedMarkers as any);

    const onSelectMarker = (e: any) => {
      const targetId = e?.marker?.config?.data?.targetPanoId;
      if (typeof targetId !== "string" || !targetId) return;
      if (panoramas.some((p) => p.id === targetId)) {
        void vt.setCurrentNode(targetId);
      } else {
        onExternalHotspotTarget?.(targetId);
      }
    };
    markers?.addEventListener("select-marker", onSelectMarker as any);

    return () => {
      vt.removeEventListener("node-changed", onNodeChangedMarkers as any);
      markers?.removeEventListener("select-marker", onSelectMarker as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingName, cacheReady, lat, lng, serialized, startId, strictHotspotLinks]);

  // ── EXTERNAL NAV ─────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !activePanoId) return;

    const vt = viewer.getPlugin(VirtualTourPlugin);
    if (!vt) return;

    const current = vt.getCurrentNode?.();

    if (!current) {
      let handled = false;
      const onFirstNode = (e: any) => {
        if (handled) return;
        handled = true;
        if (e?.node?.id !== activePanoId) {
          void vt.setCurrentNode(activePanoId);
        }
      };
      vt.addEventListener("node-changed", onFirstNode as any);
      return () => {
        handled = true;
        vt.removeEventListener("node-changed", onFirstNode as any);
      };
    }

    if (current.id === activePanoId) return;
    void vt.setCurrentNode(activePanoId);
  }, [activePanoId, serialized]);

  // Resize after content changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const t = setTimeout(() => viewer.resize(), 50);
    return () => clearTimeout(t);
  }, [serialized]);

  // ── RENDER ───────────────────────────────────────────────────────────────
  // Show a clean spinner while the first blob downloads.
  // This replaces the jarring PSV "Loading panorama…" circle.
  if (!cacheReady) {
    return (
      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Preparing panorama…</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="absolute inset-0 bg-black">
      {/*
        Suppress PSV's built-in "Loading…" overlay on node transitions.
        Since all panoramas are pre-fetched as blob: URLs, the load is
        near-instant and the overlay is just visual noise.
      */}
      <style>{`
        .psv-loader-container { display: none !important; }
      `}</style>

      <div ref={containerRef} className="absolute inset-0" />

      <button
        type="button"
        onClick={handleFullscreenToggle}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="
          absolute top-3 right-3 z-[9999]
          bg-black/70 backdrop-blur-sm text-white
          p-1.5 rounded-lg shadow-lg
          hover:bg-black/90 active:scale-95
          transition-all duration-150
          touch-manipulation
        "
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
};