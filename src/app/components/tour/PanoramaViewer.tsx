import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Info, Maximize2, Minimize2, Navigation2, ZoomIn, ZoomOut } from "lucide-react";
import { Viewer } from "@photo-sphere-viewer/core";
import {
  toggleTourImmersive,
  isTourImmersive,
  exitPseudoFullscreen,
  isPseudoFullscreen,
  exitDocumentFullscreen,
} from "../../lib/domFullscreen";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";

interface Hotspot {
  x: number;
  y: number;
  label: string;
  targetPanoId: string;
  // Optional real 360 coordinates (preferred).
  // yawDeg: 0..360 (0 = forward), pitchDeg: -90..90 (up/down)
  yawDeg?: number;
  pitchDeg?: number;
}

interface PanoramaViewerProps {
  imageUrl: string;
  name: string;
  hotspots?: Hotspot[];
  onHotspotClick?: (targetPanoId: string) => void;
}

const SERVER_URL = "http://localhost:3001";
const resolveUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  imageUrl, name, hotspots = [], onHotspotClick,
}) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  const panoramaLoadGenRef = useRef(0);

  const [zoom, setZoom] = useState(50); // PSV zoom level (approx 0..100)
  const shellRef = useRef<HTMLDivElement>(null);
  const [immersive, setImmersive] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const resolvedUrl = useMemo(() => resolveUrl(imageUrl), [imageUrl]);

  useEffect(() => {
    setZoom(50);
    setLoaded(false);
    setImgError(false);
    const t = setTimeout(() => setShowHint(false), 3500);
    return () => clearTimeout(t);
  }, [imageUrl]);

  async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let to: any;
    try {
      return await Promise.race([
        p,
        new Promise<T>((_, reject) => {
          to = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      clearTimeout(to);
    }
  }

  // Init viewer once
  useEffect(() => {
    if (!viewerContainerRef.current) return;
    if (viewerRef.current) return;

    const viewer = new Viewer({
      container: viewerContainerRef.current,
      navbar: false,
      mousewheel: true,
      touchmoveTwoFingers: false,
      loadingTxt: "Loading 360° panorama…",
      plugins: [
        MarkersPlugin.withConfig({
          markers: [],
        }),
      ],
    });

    viewerRef.current = viewer;
    markersRef.current = viewer.getPlugin(MarkersPlugin) as unknown as MarkersPlugin;

    const onReady = () => setLoaded(true);
    const onPanoramaError = () => {
      setLoaded(true);
      setImgError(true);
    };

    // core events
    viewer.addEventListener("ready", onReady);
    viewer.addEventListener("panorama-error", onPanoramaError as any);

    // marker click -> navigate
    const markers = markersRef.current;
    const onSelectMarker = (e: any) => {
      const marker = e?.marker;
      const targetPanoId = marker?.config?.data?.targetPanoId;
      if (targetPanoId) onHotspotClick?.(targetPanoId);
    };
    markers?.addEventListener("select-marker", onSelectMarker as any);

    return () => {
      try {
        const shell = shellRef.current;
        if (shell && isPseudoFullscreen(shell)) exitPseudoFullscreen(shell);
        void exitDocumentFullscreen();
        markers?.removeEventListener("select-marker", onSelectMarker as any);
        viewer.removeEventListener("ready", onReady);
        viewer.removeEventListener("panorama-error", onPanoramaError as any);
        viewer.destroy();
      } finally {
        viewerRef.current = null;
        markersRef.current = null;
      }
    };
  }, [onHotspotClick]); // IMPORTANT: do not recreate viewer when URL changes

  // Load panorama when image changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!resolvedUrl) {
      setLoaded(true);
      setImgError(true);
      return;
    }

    setLoaded(false);
    setImgError(false);

    const gen = ++panoramaLoadGenRef.current;

    void (async () => {
      try {
        await withTimeout(viewer.setPanorama(resolvedUrl), 60000, "Panorama load");
        if (gen !== panoramaLoadGenRef.current) return;
        setLoaded(true);
        setImgError(false);
      } catch {
        if (gen !== panoramaLoadGenRef.current) return;
        // If PSV aborted/choked, still allow ready-state recovery via `ready` event above.
        // This timeout mainly prevents infinite spinners on bad URLs/hangs.
        setLoaded(true);
        setImgError(true);
      }
    })();

    return () => {
      panoramaLoadGenRef.current++;
    };
  }, [resolvedUrl]);

  // Hotspots -> markers
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;

    // Backward-compatible conversion:
    // - old x: 0..100 across panorama => yaw 0..360deg
    // - old y: 0..100 top..bottom => pitch +30..-30deg (keeps markers near horizon by default)
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const markersList = hotspots.map((hs, i) => {
      const yawDeg = hs.yawDeg ?? ((hs.x ?? 0) / 100) * 360;
      const pitchDeg = hs.pitchDeg ?? (30 - clamp(hs.y ?? 50, 0, 100) * 0.6); // 0->30, 100->-30

      return {
        id: `hs-${i}`,
        position: { yaw: `${yawDeg}deg`, pitch: `${pitchDeg}deg` },
        html: `
          <button
            type="button"
            style="
              width:44px;height:44px;border-radius:999px;
              border:4px solid #fff;background:#facc15;
              box-shadow:0 10px 25px rgba(0,0,0,0.35);
              display:flex;align-items:center;justify-content:center;
              cursor:pointer;
            "
            aria-label="${hs.label ?? "Hotspot"}"
            title="${hs.label ?? ""}"
          >
            <span style="font-size:14px;color:#1e3a8a;font-weight:900;">↗</span>
          </button>
        `,
        anchor: "center center",
        data: { targetPanoId: hs.targetPanoId },
        tooltip: hs.label ? { content: hs.label, position: "top center" } : undefined,
      };
    });

    try {
      (markers as any).setMarkers(markersList);
    } catch {
      // fallback for older plugin API
      (markers as any).clearMarkers?.();
      markersList.forEach((m) => (markers as any).addMarker?.(m));
    }
  }, [hotspots]);

  const syncImmersiveUi = () => {
    const el = shellRef.current;
    setImmersive(!!el && isTourImmersive(el));
  };

  const resizePanoramaView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.resize();
    requestAnimationFrame(() => viewer.resize());
    setTimeout(() => viewer.resize(), 80);
    setTimeout(() => viewer.resize(), 250);
    requestAnimationFrame(syncImmersiveUi);
  };

  useEffect(() => {
    const onFsChange = () => resizePanoramaView();
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
    };
  }, []);

  const zoomIn = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = Math.min(100, zoom + 10);
    setZoom(next);
    viewer.zoom(next);
  };

  const zoomOut = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = Math.max(0, zoom - 10);
    setZoom(next);
    viewer.zoom(next);
  };

  const pan = (dir: "left" | "right") => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const pos = viewer.getPosition();
    const step = (15 * Math.PI) / 180;
    viewer.rotate({ yaw: pos.yaw + (dir === "left" ? -step : step), pitch: pos.pitch });
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = shellRef.current;
      if (!el || !isPseudoFullscreen(el)) return;
      exitPseudoFullscreen(el);
      resizePanoramaView();
      setImmersive(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div
      ref={shellRef}
      className={`relative h-full overflow-hidden bg-black select-none ${immersive ? "" : "rounded-2xl"}`}
    >
      {/* ── Panorama image ─────────────────────────────────────────────────── */}
      <div
        ref={viewerContainerRef}
        className="absolute inset-0"
        style={{ cursor: "grab" }}
      >
        {/* Loading spinner */}
        {!loaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
              <p className="text-white/60 text-xs mt-3">Loading 360° panorama…</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-sm font-semibold">Could not load panorama</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto break-all">{resolvedUrl}</p>
            </div>
          </div>
        )}

        {/* Atmospheric overlays */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.25) 100%)" }} />
        <div className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }} />
      </div>

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg flex items-center gap-2">
          <Info size={14} />
          <span className="text-sm font-semibold">{name}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={zoomIn}
            className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-lg hover:bg-black/80 transition-colors" title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button onClick={zoomOut}
            className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-lg hover:bg-black/80 transition-colors" title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              const el = shellRef.current;
              const viewer = viewerRef.current;
              if (!el || !viewer) return;
              void toggleTourImmersive(el, resizePanoramaView).then(() => resizePanoramaView());
            }}
            className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-lg hover:bg-black/80 transition-colors"
            title={immersive ? "Exit fullscreen" : "Fullscreen"}
          >
            {immersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* ── Navigator arrows ─────────────────────────────────────────────── */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
        <button onClick={() => pan("left")} className="bg-black/60 backdrop-blur-sm text-white p-3 rounded-full hover:bg-yellow-500 hover:text-blue-900 transition-all shadow-lg">
          <ChevronLeft size={22} />
        </button>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
        <button onClick={() => pan("right")} className="bg-black/60 backdrop-blur-sm text-white p-3 rounded-full hover:bg-yellow-500 hover:text-blue-900 transition-all shadow-lg">
          <ChevronRight size={22} />
        </button>
      </div>

      {/* ── Drag hint ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHint && loaded && !imgError && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div className="bg-black/70 text-white px-6 py-4 rounded-2xl flex flex-col items-center gap-2">
              <motion.div animate={{ x: [-12, 12, -12] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Navigation2 size={28} />
              </motion.div>
              <p className="text-sm font-semibold">Drag to explore 360°</p>
              <p className="text-xs text-white/60">Scroll to zoom · Arrow buttons to pan</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
