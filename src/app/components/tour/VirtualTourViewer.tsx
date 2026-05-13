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
  const dLng =
    (meters * Math.sin(t)) / (111_320 * Math.cos((lat * Math.PI) / 180));
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
        tooltip: hs.label
          ? { content: hs.label, position: "top center" as const }
          : undefined,
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
        if (tIdx !== -1)
          links.push({ nodeId: tid, gps: offsetGps(lng, lat, tIdx, total) });
      }
    } else if (!strictHotspotLinks && total > 1) {
      const nextIdx = (idx + 1) % total;
      const prevIdx = (idx - 1 + total) % total;
      links.push({
        nodeId: panoramas[nextIdx].id,
        gps: offsetGps(lng, lat, nextIdx, total),
      });
      if (total > 2) {
        links.push({
          nodeId: panoramas[prevIdx].id,
          gps: offsetGps(lng, lat, prevIdx, total),
        });
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
        p.panoData?.poseHeading != null
          ? { poseHeading: p.panoData.poseHeading }
          : undefined,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const onNodeChangeRef = useRef(onNodeChange);
  useEffect(() => {
    onNodeChangeRef.current = onNodeChange;
  }, [onNodeChange]);

  const startId = useMemo(
    () =>
      (startPanoId && panoramas.some((p) => p.id === startPanoId)
        ? startPanoId
        : undefined) ?? panoramas[0]?.id,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startPanoId, panoramas[0]?.id],
  );

  // Stable string dep — only changes when panorama content changes, not when
  // the array reference changes (which happens on every parent render).
  const serialized = useMemo(
    () => panoramas.map((p) => `${p.id}|${p.name}|${p.imageUrl}`).join(";;"),
    [panoramas],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // INIT — creates the PSV viewer shell once. No panorama, no setNodes here.
  //
  // WHY no `panorama` in constructor:
  //   VirtualTourPlugin owns all panorama loading via setNodes(). Passing
  //   `panorama` to the constructor AND calling setNodes() creates a race —
  //   the plugin's setNodes() interrupts the constructor load, leaving the
  //   viewer permanently stuck on the loading spinner.
  //
  // WHY no setNodes() here:
  //   The NODES effect below runs in the same React batch (effects flush in
  //   definition order after the same render). Calling setNodes() in BOTH
  //   effects causes a double-call that recreates the same stuck-loading race.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const resizeAfterLayout = () => {
      const v = viewerRef.current;
      if (!v) return;
      v.resize();
      requestAnimationFrame(() => v.resize());
      setTimeout(() => v.resize(), 50);
      setTimeout(() => v.resize(), 250);
    };

    const FS_ICON =
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    const viewer = new PsvViewer({
      container: containerRef.current,
      // No `panorama` — VirtualTourPlugin handles loading via setNodes().
      // Avoid external loadingImg URL (slow/unavailable network); use text instead.
      loadingTxt: "Loading panorama…",
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

    const onFsChange = () => resizeAfterLayout();
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);

    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const v = viewerRef.current;
      if (!v || !isPseudoFullscreen(v.parent)) return;
      exitPseudoFullscreen(v.parent);
      resizeAfterLayout();
    };
    window.addEventListener("keydown", onEsc);

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
        document.removeEventListener("fullscreenchange", onFsChange);
        document.removeEventListener(
          "webkitfullscreenchange",
          onFsChange as EventListener,
        );
        window.removeEventListener("keydown", onEsc);
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount

  // ─────────────────────────────────────────────────────────────────────────
  // NODES — calls setNodes whenever panorama content changes.
  //
  // Also handles the very first load: this effect runs in the same React
  // batch as the INIT effect (effects flush in definition order), so there
  // is no perceptible delay between viewer creation and panorama loading.
  //
  // `panoramas` (array identity) is intentionally omitted from deps.
  // `serialized` is a stable string proxy that only changes when content does,
  // preventing spurious setNodes() calls on every parent re-render.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const vt = viewer.getPlugin(VirtualTourPlugin);
    const markers = viewer.getPlugin(MarkersPlugin);
    if (!vt) return;

    const { nodes, markersByPanoId } = buildNodes(
      panoramas,
      buildingName,
      lng,
      lat,
      strictHotspotLinks,
    );

    vt.setNodes(nodes, startId);

    const syncMarkers = (panoId?: string) => {
      if (!markers) return;
      const list = markersByPanoId.get(panoId ?? "") ?? [];
      try {
        (markers as any).setMarkers(list);
      } catch {
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
  // `panoramas` intentionally omitted — `serialized` covers all content changes

  // ─────────────────────────────────────────────────────────────────────────
  // EXTERNAL NAV — handles sidebar / viewpoint-list clicks.
  //
  // CRITICAL GUARD — `if (!current) return`:
  //   On first mount this effect runs in the same batch as the NODES effect.
  //   setNodes() was just called but hasn't finished loading the first
  //   panorama yet, so getCurrentNode() returns null/undefined at this point.
  //   Without the guard we'd call setCurrentNode() immediately, interrupting
  //   the in-progress load and causing the first viewpoint to get stuck.
  //   With the guard: if nothing is loaded yet, we leave setNodes() alone.
  //   Subsequent sidebar clicks work normally — getCurrentNode() returns the
  //   loaded node, the id check fires, and setCurrentNode() navigates.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !activePanoId) return;

    const vt = viewer.getPlugin(VirtualTourPlugin);
    if (!vt) return;

    const current = vt.getCurrentNode?.();
    if (!current) return; // initial load in progress — don't interrupt
    if (current.id === activePanoId) return; // already on the right node

    void vt.setCurrentNode(activePanoId);
  }, [activePanoId, serialized]);

  // Resize after content changes (e.g. panorama added via admin panel)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const t = setTimeout(() => viewer.resize(), 50);
    return () => clearTimeout(t);
  }, [serialized]);

  return <div ref={containerRef} className="absolute inset-0 bg-black" />;
};