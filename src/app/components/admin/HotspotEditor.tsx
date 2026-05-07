import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, MapPin, MousePointer2, Search, AlertCircle } from "lucide-react";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import { SERVER_URL } from "../../lib/api";

export type EditableHotspot = {
  label: string;
  targetPanoId: string;
  yawDeg?: number;
  pitchDeg?: number;
  /** legacy 0..100 coords kept for backward compat */
  x?: number;
  y?: number;
};

type PanoOption = {
  id: string;
  name: string;
  buildingId?: string;
  buildingName?: string;
};

type Props = {
  imageUrl: string;
  /** id of the panorama being edited, so we can omit it from target options */
  selfPanoId?: string | null;
  panoOptions: PanoOption[];
  hotspots: EditableHotspot[];
  onChange: (next: EditableHotspot[]) => void;
};

const resolveUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
};

const radToDeg = (rad: number) => (rad * 180) / Math.PI;
const normalizeDeg = (deg: number) => ((deg % 360) + 360) % 360;

const ARROW_HTML = (label: string, selected: boolean) => `
  <button type="button"
    style="width:44px;height:44px;border-radius:999px;
           border:4px solid ${selected ? "#3b82f6" : "#fff"};
           background:${selected ? "#fde68a" : "#facc15"};
           box-shadow:0 10px 25px rgba(0,0,0,0.35);
           display:flex;align-items:center;justify-content:center;cursor:pointer;
           transform:scale(${selected ? 1.1 : 1});"
    aria-label="${label || "Hotspot"}" title="${label || ""}">
    <span style="font-size:14px;color:#1e3a8a;font-weight:900;">↗</span>
  </button>
`;

export const HotspotEditor: React.FC<Props> = ({
  imageUrl,
  selfPanoId,
  panoOptions,
  hotspots,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  const hotspotsRef = useRef<EditableHotspot[]>(hotspots);
  const onChangeRef = useRef(onChange);
  const selectedIdxRef = useRef<number | null>(null);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const placeModeRef = useRef(placeMode);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    selectedIdxRef.current = selectedIdx;
  }, [selectedIdx]);
  useEffect(() => {
    placeModeRef.current = placeMode;
  }, [placeMode]);

  const resolvedUrl = useMemo(() => resolveUrl(imageUrl), [imageUrl]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return panoOptions
      .filter((p) => p.id !== selfPanoId)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.buildingName || "").toLowerCase().includes(q)
        );
      });
  }, [panoOptions, selfPanoId, search]);

  // Init viewer once. Recreate if URL changes since markers/preview depend on the panorama.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !resolvedUrl) return;

    setLoaded(false);
    setLoadError(false);

    const viewer = new Viewer({
      container: el,
      panorama: resolvedUrl,
      navbar: false,
      mousewheel: true,
      touchmoveTwoFingers: false,
      loadingTxt: "Loading panorama…",
      plugins: [MarkersPlugin.withConfig({ markers: [] })],
    });

    viewerRef.current = viewer;
    markersRef.current = viewer.getPlugin(MarkersPlugin) as unknown as MarkersPlugin;

    const onReady = () => setLoaded(true);
    const onPanoramaError = () => {
      setLoaded(true);
      setLoadError(true);
    };
    viewer.addEventListener("ready", onReady);
    viewer.addEventListener("panorama-error", onPanoramaError as any);

    /**
     * Click while in placement mode → save yaw/pitch into the selected hotspot.
     * PSV ClickEvent yaw/pitch are in radians.
     */
    const onClick = (e: any) => {
      if (!placeModeRef.current) return;
      const idx = selectedIdxRef.current;
      if (idx == null) return;
      const data = e?.data;
      if (data == null || typeof data.yaw !== "number" || typeof data.pitch !== "number") return;

      const yawDeg = normalizeDeg(radToDeg(data.yaw));
      const pitchDeg = Math.max(-90, Math.min(90, radToDeg(data.pitch)));
      const next = [...hotspotsRef.current];
      if (!next[idx]) return;
      next[idx] = {
        ...next[idx],
        yawDeg,
        pitchDeg,
        x: (yawDeg / 360) * 100,
        y: 50 - pitchDeg * 0.5,
      };
      onChangeRef.current(next);
      setPlaceMode(false);
    };
    viewer.addEventListener("click", onClick as any);

    return () => {
      try {
        viewer.removeEventListener("ready", onReady);
        viewer.removeEventListener("panorama-error", onPanoramaError as any);
        viewer.removeEventListener("click", onClick as any);
        viewer.destroy();
      } finally {
        viewerRef.current = null;
        markersRef.current = null;
      }
    };
  }, [resolvedUrl]);

  // Sync markers whenever hotspots / selection / placement state changes.
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers || !loaded) return;

    const list = hotspots
      .map((hs, i) => {
        const yawDeg =
          typeof hs.yawDeg === "number" ? hs.yawDeg : ((hs.x ?? 0) / 100) * 360;
        const pitchDeg =
          typeof hs.pitchDeg === "number"
            ? hs.pitchDeg
            : 30 - Math.max(0, Math.min(100, hs.y ?? 50)) * 0.6;
        const isSelected = selectedIdx === i;
        return {
          id: `hs-edit-${i}`,
          position: { yaw: `${yawDeg}deg`, pitch: `${pitchDeg}deg` },
          html: ARROW_HTML(hs.label, isSelected),
          anchor: "center center",
          data: { idx: i },
          tooltip: hs.label ? { content: hs.label, position: "top center" } : undefined,
        };
      })
      .filter(Boolean) as any[];

    try {
      (markers as any).setMarkers(list);
    } catch {
      (markers as any).clearMarkers?.();
      list.forEach((m) => (markers as any).addMarker?.(m));
    }
  }, [hotspots, selectedIdx, loaded]);

  // Click an existing marker → select it (instead of treating as a placement click)
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;
    const onSelect = (e: any) => {
      const idx = e?.marker?.config?.data?.idx;
      if (typeof idx === "number") setSelectedIdx(idx);
    };
    markers.addEventListener("select-marker", onSelect as any);
    return () => markers.removeEventListener("select-marker", onSelect as any);
  }, [loaded]);

  const addHotspot = () => {
    const next: EditableHotspot[] = [
      ...hotspots,
      { label: "New hotspot", targetPanoId: "", yawDeg: 0, pitchDeg: 0 },
    ];
    onChange(next);
    setSelectedIdx(next.length - 1);
    setPlaceMode(true);
  };

  const updateHotspot = (idx: number, patch: Partial<EditableHotspot>) => {
    const next = [...hotspots];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeHotspot = (idx: number) => {
    const next = hotspots.filter((_, i) => i !== idx);
    onChange(next);
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx != null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  if (!resolvedUrl) {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
        Upload or set a panorama image first to author hotspots.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid lg:grid-cols-[2fr_1fr] gap-3">
        {/* Viewer */}
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black" style={{ minHeight: 320 }}>
          <div ref={containerRef} className="absolute inset-0" />
          {!loaded && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
              <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Loading…
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm gap-1">
              <AlertCircle size={18} />
              Could not load panorama image
            </div>
          )}
          {loaded && placeMode && selectedIdx != null && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
              <MousePointer2 size={13} /> Click on the panorama to place hotspot #{selectedIdx + 1}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2 min-h-[320px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Hotspots ({hotspots.length})</p>
            <button
              type="button"
              onClick={addHotspot}
              className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {hotspots.length === 0 ? (
            <p className="text-xs text-gray-500 mt-2">
              No hotspots yet. Click <strong>Add</strong>, then click on the panorama to place an arrow.
            </p>
          ) : (
            <ul className="space-y-1.5 overflow-y-auto pr-1 max-h-[260px]">
              {hotspots.map((hs, i) => {
                const target = panoOptions.find((p) => p.id === hs.targetPanoId);
                const selected = selectedIdx === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelectedIdx(i)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition ${
                        selected
                          ? "border-blue-500 bg-white shadow-sm"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-yellow-400 text-blue-900 font-black flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-gray-800 truncate">
                          {hs.label || "(untitled)"}
                        </span>
                        <span className="block text-gray-500 truncate">
                          {target ? `→ ${target.name}` : hs.targetPanoId ? "→ unknown target" : "→ no target"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHotspot(i);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove hotspot"
                      >
                        <Trash2 size={13} />
                      </button>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Editing form for selected hotspot */}
      {selectedIdx != null && hotspots[selectedIdx] && (
        <div className="bg-white border-2 border-blue-200 rounded-xl p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-gray-800 text-sm">Edit hotspot #{selectedIdx + 1}</p>
            <button
              type="button"
              onClick={() => setPlaceMode((v) => !v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                placeMode ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              <MapPin size={13} /> {placeMode ? "Click panorama…" : "Place on panorama"}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Label</label>
              <input
                value={hotspots[selectedIdx].label}
                onChange={(e) => updateHotspot(selectedIdx, { label: e.target.value })}
                placeholder="e.g. Go to CETAFA Dean's Office"
                className="w-full px-2.5 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Target panorama</label>
              <div className="space-y-1.5">
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search panoramas…"
                    className="w-full pl-7 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={hotspots[selectedIdx].targetPanoId || ""}
                  onChange={(e) => updateHotspot(selectedIdx, { targetPanoId: e.target.value })}
                  className="w-full px-2.5 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="">— Select target —</option>
                  {filteredOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.buildingName ? `${p.buildingName} · ${p.name}` : p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Yaw (°)</label>
                <input
                  type="number"
                  step="any"
                  value={hotspots[selectedIdx].yawDeg ?? 0}
                  onChange={(e) =>
                    updateHotspot(selectedIdx, { yawDeg: Number(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Pitch (°)</label>
                <input
                  type="number"
                  step="any"
                  value={hotspots[selectedIdx].pitchDeg ?? 0}
                  onChange={(e) =>
                    updateHotspot(selectedIdx, { pitchDeg: Number(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {!hotspots[selectedIdx].targetPanoId && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Pick a target panorama for this arrow before saving.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
