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

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/gallery-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";

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
const resolveUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
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
          <button type="button"
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
      panorama: resolveUrl(p.imageUrl),
      thumbnail: resolveUrl(p.imageUrl),
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
  const shellRef = useRef<HTMLDivElement>(null);    // outer wrapper — fullscreen target
  const containerRef = useRef<HTMLDivElement>(null); // PSV mounts here
  const viewerRef = useRef<Viewer | null>(null);
  const onNodeChangeRef = useRef(onNodeChange);
  useEffect(() => { onNodeChangeRef.current = onNodeChange; }, [onNodeChange]);

  // Tracks whether we are currently in fullscreen (native or pseudo).
  // Used to swap the Maximize2 / Minimize2 icon on the overlay button.
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Shared resize helper — call after any layout change
  const resizeViewer = () => {
    const v = viewerRef.current;
    if (!v) return;
    v.resize();
    requestAnimationFrame(() => v.resize());
    setTimeout(() => v.resize(), 50);
    setTimeout(() => v.resize(), 250);
  };

  // Sync the React fullscreen state from the DOM
  const syncFullscreenState = () => {
    const el = shellRef.current;
    setIsFullscreen(
      (!!el && isPseudoFullscreen(el)) || !!document.fullscreenElement,
    );
  };

  // Called by the overlay button
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

  // ── INIT ────────────────────────────────────────────────────────────────
  // Creates the PSV viewer shell ONLY. No panorama, no setNodes.
  //
  // WHY no `panorama` in constructor + no setNodes here:
  //   VirtualTourPlugin owns all panorama loading via setNodes(). Passing
  //   `panorama` to constructor AND calling setNodes() creates a race that
  //   leaves the first viewpoint permanently stuck on the loading spinner.
  //   The NODES effect below runs in the same React batch (effects flush in
  //   definition order), so there is no visible gap.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new PsvViewer({
      container: containerRef.current,
      // No `panorama` — VirtualTourPlugin manages all loading via setNodes().
      loadingTxt: "Loading panorama…", // no external image request
      // Single-finger drag on mobile (touchmoveTwoFingers: true shows
      // the "Use two fingers to navigate" blocker overlay on iOS/Android).
      touchmoveTwoFingers: false,
      mousewheelCtrlKey: true, // desktop: Ctrl+scroll to zoom (avoids page-scroll conflict)
      defaultYaw: "130deg",
      defaultZoomLvl: 50,
      // The fullscreen button is handled by our React overlay below, so it is
      // intentionally omitted from the PSV navbar to avoid duplicates.
      navbar: ["zoom", "move", "gallery", "caption"],
      plugins: [
        MarkersPlugin,
        [GalleryPlugin, { thumbnailSize: { width: 100, height: 100 } }],
        [
          VirtualTourPlugin,
          {
            dataMode: "client",
            positionMode: "gps",
            renderMode: "3d",
            preload: false,
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

    // Resize + sync icon on native fullscreen change (Android / desktop)
    const onFsChange = () => { resizeViewer(); syncFullscreenState(); };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);

    // Escape key exits pseudo-fullscreen (desktop)
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
  }, []); // Runs once on mount

  // ── NODES ───────────────────────────────────────────────────────────────
  // Calls setNodes when panorama content changes (and on first mount, since
  // this effect runs in the same React batch as the INIT effect above).
  // `panoramas` array identity is omitted — `serialized` is the stable proxy.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const vt = viewer.getPlugin(VirtualTourPlugin);
    const markers = viewer.getPlugin(MarkersPlugin);
    if (!vt) return;

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
  }, [buildingName, lat, lng, serialized, startId, strictHotspotLinks]);

  // ── EXTERNAL NAV ────────────────────────────────────────────────────────
  // Handles sidebar / viewpoint-list clicks.
  //
  // GUARD — `if (!current) return`:
  //   On first mount this runs while the initial panorama is still loading
  //   (getCurrentNode returns null). Without the guard, setCurrentNode would
  //   interrupt that load, causing the first viewpoint to get stuck.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !activePanoId) return;

    const vt = viewer.getPlugin(VirtualTourPlugin);
    if (!vt) return;

    const current = vt.getCurrentNode?.();
    if (!current) return; // initial load in progress — don't interrupt
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

  return (
    // shellRef is the fullscreen target. Needs to be the outermost element so
    // our overlay button stays visible when the viewer goes fullscreen.
    <div ref={shellRef} className="absolute inset-0 bg-black">
      {/* PSV mounts inside this div */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── Fullscreen overlay button ──────────────────────────────────────
          Rendered by React so it works on iOS (where native fullscreen API
          is unsupported) and is always visible regardless of PSV navbar state.
          Position: top-right corner, above PSV's own UI (z-[9999]).
          On Android/desktop this uses native fullscreen; on iOS it falls back
          to pseudo-fullscreen (CSS fixed positioning via toggleTourImmersive).
      ──────────────────────────────────────────────────────────────────── */}
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