import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Navigation2, Info } from "lucide-react";

interface Hotspot {
  x: number;
  y: number;
  label: string;
  targetPanoId: string;
}

interface PanoramaViewerProps {
  imageUrl: string;
  name: string;
  hotspots?: Hotspot[];
  onHotspotClick?: (targetPanoId: string) => void;
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  imageUrl, name, hotspots = [], onHotspotClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offset, setOffset] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setOffset(0);
    setCurrentOffset(0);
    setLoaded(false);
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, [imageUrl]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setStartX(e.clientX);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) * 0.3;
    const newOffset = currentOffset + delta;
    const clamped = Math.max(-60, Math.min(0, newOffset));
    setOffset(clamped);
  }, [dragging, startX, currentOffset]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setCurrentOffset(offset);
  }, [offset]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setDragging(true);
    setStartX(e.touches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const delta = (e.touches[0].clientX - startX) * 0.3;
    const newOffset = currentOffset + delta;
    const clamped = Math.max(-60, Math.min(0, newOffset));
    setOffset(clamped);
  }, [dragging, startX, currentOffset]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    setCurrentOffset(offset);
  }, [offset]);

  const pan = (direction: "left" | "right") => {
    const delta = direction === "left" ? 15 : -15;
    const newOffset = Math.max(-60, Math.min(0, currentOffset + delta));
    setCurrentOffset(newOffset);
    setOffset(newOffset);
  };

  // Calculate the percentage from left (0 = far left, 100 = center)
  const pctFromLeft = Math.abs(offset) / 60;

  return (
    <div
      className={`relative overflow-hidden bg-black select-none ${fullscreen ? "fixed inset-0 z-50" : "rounded-2xl"}`}
      style={{ height: fullscreen ? "100vh" : "100%" }}
    >
      {/* Main panorama image */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        <img
          src={imageUrl}
          alt={name}
          onLoad={() => setLoaded(true)}
          className="absolute top-0 left-0 h-full object-cover pointer-events-none"
          style={{
            width: "200%",
            transform: `translateX(${offset * 1.67}%)`,
            transition: dragging ? "none" : "transform 0.3s ease-out",
            opacity: loaded ? 1 : 0,
          }}
          draggable={false}
        />

        {/* Dark overlay on edges for depth effect */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.3) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.3) 100%)" }} />

        {/* Sky gradient at top */}
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)" }} />

        {/* Floor gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)" }} />
      </div>

      {/* Hotspots */}
      {loaded && hotspots.map((hs, i) => {
        // Calculate hotspot visibility based on current view offset
        const visibleX = ((pctFromLeft * 50) + (hs.x * 0.5));
        const screenX = hs.x - Math.abs(offset) * 0.7;
        if (screenX < -10 || screenX > 110) return null;
        return (
          <motion.button
            key={i}
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute z-10 group"
            style={{ left: `${screenX}%`, top: `${hs.y}%`, transform: "translate(-50%, -50%)" }}
            onClick={() => onHotspotClick?.(hs.targetPanoId)}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-yellow-500 border-4 border-white rounded-full flex items-center justify-center shadow-lg animate-pulse group-hover:scale-125 transition-transform">
                <Navigation2 size={16} className="text-blue-900" />
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <div className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  {hs.label}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg flex items-center gap-2 pointer-events-auto">
          <Info size={14} />
          <span className="text-sm font-semibold">{name}</span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setFullscreen(!fullscreen)}
            className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-lg hover:bg-black/80 transition-colors">
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
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

      {/* Progress bar (shows viewing position) */}
      <div className="absolute bottom-16 left-6 right-6 z-20">
        <div className="h-1 bg-white/30 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.abs(offset / 60) * 100}%`, marginLeft: "0" }} />
        </div>
        <div className="flex justify-between text-white/50 text-xs mt-1">
          <span>◀ Drag to explore</span>
          <span>▶</span>
        </div>
      </div>

      {/* Drag hint */}
      <AnimatePresence>
        {showHint && loaded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div className="bg-black/70 text-white px-6 py-4 rounded-2xl flex flex-col items-center gap-2">
              <motion.div animate={{ x: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Navigation2 size={28} />
              </motion.div>
              <p className="text-sm font-semibold">Drag to look around</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
