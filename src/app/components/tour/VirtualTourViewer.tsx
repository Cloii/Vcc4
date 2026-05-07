import React, { useEffect, useMemo, useRef } from "react";
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
  /** building lng/lat (EPSG:4326) used for GPS-mode link placement */
  lng: number;
  lat: number;
  panoramas: TourPano[];
  /**
   * Optional external selection (e.g. clicking a viewpoint in the page sidebar).
   * When it changes, the tour will jump to that node without remounting the viewer.
   */
  activePanoId?: string;
  /** Optional explicit start node id (campus-wide tour main-gate). Falls back to first pano. */
  startPanoId?: string;
  /**
   * When true, links between nodes come ONLY from each panorama's hotspots
   * (no automatic chaining of next/prev). Used by the campus-wide explore tour.
   */
  strictHotspotLinks?: boolean;
  /**
   * Optional hook for cross-building jumps. If a hotspot targets a panoId
   * that is not in the current `panoramas` list, we call this instead of
   * trying to navigate inside the virtual tour nodes.
   */
  onExternalHotspotTarget?: (targetPanoId: string) => void;
  /** Called whenever the current node changes (tour navigation) */
  onNodeChange?: (panoId: string) => void;
};

const DEMO_ASSETS = "https://photo-sphere-viewer-data.netlify.app/assets/";
const LOADER_GIF = `${DEMO_ASSETS}loader.gif`;

const SERVER_URL = "http://localhost:3001";

const resolveUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const offsetGps = (lng: number, lat: number, idx: number, total: number): [number, number, number] => {
  // Small circular jitter around the building point so every node has a distinct GPS coordinate.
  const t = (idx / Math.max(1, total)) * Math.PI * 2;
  const meters = 1.2 + idx * 0.35;
  const dLat = (meters * Math.cos(t)) / 111_320;
  const dLng = (meters * Math.sin(t)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  const alt = 2 + (idx % 5);
  return [lng + dLng, lat + dLat, alt];
};

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
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const onNodeChangeRef = useRef(onNodeChange);

  const startId =
    (startPanoId && panoramas.some((p) => p.id === startPanoId) ? startPanoId : undefined) ||
    panoramas[0]?.id;

  const serialized = useMemo(
    () => panoramas.map(p => `${p.id}|${p.name}|${p.imageUrl}`).join(";;"),
    [panoramas],
  );

  useEffect(() => {
    onNodeChangeRef.current = onNodeChange;
  }, [onNodeChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current) return;

    const resizeAfterLayout = () => {
      const v = viewerRef.current;
      if (!v) return;
      v.resize();
      requestAnimationFrame(() => v.resize());
      setTimeout(() => v.resize(), 50);
      setTimeout(() => v.resize(), 250);
    };

    const onFullscreenChange = () => resizeAfterLayout();

    /** Built-in navbar fullscreen relies on unprefixed APIs and can reject silently — use fullscreen + pseudo fallback */
    const FS_ICON =
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    const viewer = new PsvViewer({
      container: containerRef.current,
      caption: `${buildingName} · ${panoramas[0]?.name ?? ""}`,
      loadingImg: LOADER_GIF,
      touchmoveTwoFingers: true,
      mousewheelCtrlKey: true,
      defaultYaw: "130deg",
      defaultZoomLvl: 50,
      navbar: [
        "zoom",
        "move",
        "gallery",
        "caption",
        {
          id: "immersive-fullscreen",
          title: "Fullscreen",
          collapsable: false,
          tabbable: true,
          content: FS_ICON,
          onClick: (v: Viewer) => {
            void toggleTourImmersive(v.parent, resizeAfterLayout);
          },
        },
      ],
      plugins: [
        MarkersPlugin,
        [GalleryPlugin, { thumbnailSize: { width: 100, height: 100 } }],
        [
          VirtualTourPlugin,
          {
            dataMode: "client",
            positionMode: "gps",
            renderMode: "3d",
            preload: true,
            showLinkTooltip: true,
          },
        ],
      ],
    });

    viewerRef.current = viewer;

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange as EventListener);

    const onEscapePseudo = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const v = viewerRef.current;
      if (!v) return;
      const el = v.parent;
      if (!isPseudoFullscreen(el)) return;
      exitPseudoFullscreen(el);
      resizeAfterLayout();
    };
    window.addEventListener("keydown", onEscapePseudo);

    const vt = viewer.getPlugin(VirtualTourPlugin);

    const onNodeChanged = (e: any) => {
      const id = e?.node?.id;
      if (typeof id === "string") onNodeChangeRef.current?.(id);
    };
    vt.addEventListener("node-changed", onNodeChanged as any);

    return () => {
      try {
        const v = viewerRef.current;
        if (v) {
          if (isPseudoFullscreen(v.parent)) exitPseudoFullscreen(v.parent);
          void exitDocumentFullscreen();
          vt.removeEventListener("node-changed", onNodeChanged as any);
        }
        viewer.destroy();
      } finally {
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", onFullscreenChange as EventListener);
        window.removeEventListener("keydown", onEscapePseudo);
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const vt = viewer.getPlugin(VirtualTourPlugin);
    const markers = viewer.getPlugin(MarkersPlugin);
    if (!vt) return;

    const total = panoramas.length;
    const markerByPanoId = new Map<string, any[]>();
    const nodes = panoramas.map((p, idx) => {
      const gps = offsetGps(lng, lat, idx, total);

      const hotspotMarkers = (p.hotspots || []).map((hs, i) => {
        const yawDeg = hs.yawDeg ?? ((hs.x ?? 0) / 100) * 360;
        const pitchDeg = hs.pitchDeg ?? (30 - clamp(hs.y ?? 50, 0, 100) * 0.6);

        return {
          id: `hs-${p.id}-${i}`,
          position: { yaw: `${yawDeg}deg`, pitch: `${pitchDeg}deg` },
          html: `
            <button type="button"
              style="width:44px;height:44px;border-radius:999px;border:4px solid #fff;background:#facc15;
                     box-shadow:0 10px 25px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;">
              <span style="font-size:14px;color:#1e3a8a;font-weight:900;">↗</span>
            </button>
          `,
          anchor: "center center" as const,
          tooltip: hs.label ? { content: hs.label, position: "top center" as const } : undefined,
          data: { targetPanoId: hs.targetPanoId },
        };
      });
      markerByPanoId.set(p.id, hotspotMarkers);

      const links: any[] = [];

      // Prefer explicit hotspot-defined links; otherwise chain panoramas in the current sort order
      // (unless strictHotspotLinks is on — then never auto-chain).
      const hsTargets = [...new Set((p.hotspots || []).map(h => h.targetPanoId).filter(Boolean))];
      if (hsTargets.length > 0) {
        for (const tid of hsTargets) {
          const target = panoramas.find(x => x.id === tid);
          if (!target) continue;
          const tIdx = panoramas.findIndex(x => x.id === tid);
          const tGps = offsetGps(lng, lat, Math.max(0, tIdx), total);
          links.push({ nodeId: tid, gps: tGps });
        }
      } else if (!strictHotspotLinks && total > 1) {
        const next = panoramas[(idx + 1) % total];
        const prev = panoramas[(idx - 1 + total) % total];
        const nextIdx = panoramas.findIndex(x => x.id === next.id);
        const prevIdx = panoramas.findIndex(x => x.id === prev.id);
        links.push({ nodeId: next.id, gps: offsetGps(lng, lat, Math.max(0, nextIdx), total) });
        if (total > 2) {
          links.push({ nodeId: prev.id, gps: offsetGps(lng, lat, Math.max(0, prevIdx), total) });
        }
      }

      return {
        id: p.id,
        name: p.name,
        panorama: resolveUrl(p.imageUrl),
        thumbnail: resolveUrl(p.imageUrl),
        caption: `${buildingName} · ${p.name}`,
        gps,
        panoData: p.panoData?.poseHeading != null ? { poseHeading: p.panoData.poseHeading } : undefined,
        links,
        // VirtualTourPlugin does not always render node markers consistently in 3D mode,
        // so we also set markers explicitly on node changes (below).
        markers: hotspotMarkers,
      };
    });

    vt.setNodes(nodes, startId);

    const syncMarkersForNode = (panoId?: string) => {
      if (!markers) return;
      const list = markerByPanoId.get(panoId || "") || [];
      try {
        (markers as any).setMarkers(list);
      } catch {
        (markers as any).clearMarkers?.();
        list.forEach((m: any) => (markers as any).addMarker?.(m));
      }
    };

    // Set markers for the initial node immediately.
    syncMarkersForNode(startId);

    // When the current node changes, refresh markers.
    const onNodeChangedMarkers = (e: any) => {
      const id = e?.node?.id;
      if (typeof id === "string") syncMarkersForNode(id);
    };
    vt.addEventListener("node-changed", onNodeChangedMarkers as any);

    // Marker clicks (hotspots): navigate VirtualTour nodes by id (or bubble up for external jump)
    const onSelectMarker = (e: any) => {
      const targetPanoId = e?.marker?.config?.data?.targetPanoId;
      if (typeof targetPanoId === "string" && targetPanoId.length > 0) {
        if (panoramas.some((p) => p.id === targetPanoId)) {
          void vt.setCurrentNode(targetPanoId);
        } else {
          onExternalHotspotTarget?.(targetPanoId);
        }
      }
    };
    markers?.addEventListener("select-marker", onSelectMarker as any);

    return () => {
      vt.removeEventListener("node-changed", onNodeChangedMarkers as any);
      markers?.removeEventListener("select-marker", onSelectMarker as any);
    };
  }, [buildingName, lat, lng, panoramas, serialized, startId, strictHotspotLinks]);

  // External navigation (sidebar / lists)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const vt = viewer.getPlugin(VirtualTourPlugin);
    if (!vt) return;
    if (!activePanoId) return;

    const current = vt.getCurrentNode?.();
    if (current?.id === activePanoId) return;

    void vt.setCurrentNode(activePanoId);
  }, [activePanoId, serialized]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const t = setTimeout(() => viewer.resize(), 50);
    return () => clearTimeout(t);
  }, [serialized]);

  return <div ref={containerRef} className="absolute inset-0 bg-black" />;
};
