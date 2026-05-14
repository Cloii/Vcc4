import React, { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { logActivity, createSecurityAlert } from "../../lib/api";

// ── How each detection works ───────────────────────────────────────────────────
//
//  1. getDisplayMedia intercept  — fires the moment the browser screen-share /
//     screen-record dialog is triggered (Loom, OBS capture, browser share, etc.)
//     Severity: HIGH  |  Cooldown: 60 s
//
//  2. PrintScreen key            — catches bare PrintScreen, Ctrl+PrintScreen,
//     and Alt+PrintScreen keyup events.
//     Severity: MEDIUM  |  Cooldown: 15 s
//
//  3. Visibility change bursts   — a tab that's being screen-recorded by an
//     external tool often causes many rapid hide/show cycles.  We count changes
//     within a 20-second rolling window; 6+ changes triggers an alert.
//     Severity: MEDIUM  |  Cooldown: 60 s
//
//  4. DevTools opened            — compares outerWidth/Height vs innerWidth/Height
//     on every window resize; a gap > 160 px means a panel is docked.
//     Severity: LOW  |  Cooldown: 120 s
//
//  5. Rapid navigation           — more than 8 route changes in 10 seconds.
//     Severity: LOW  |  Cooldown: 30 s
//
// Every detection writes to BOTH activity_logs (full audit trail) AND
// security_alerts (actionable for admins).  Cooldowns prevent DB spam.
// ──────────────────────────────────────────────────────────────────────────────

export const SecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Rolling window for rapid-navigation detection
  const navTimestamps = useRef<number[]>([]);
  // Rolling window for visibility-change burst detection
  const visTimestamps = useRef<number[]>([]);
  // Per-type cooldown registry: type → last-fired timestamp
  const cooldowns = useRef<Map<string, number>>(new Map());
  // Whether the component is still mounted (prevents state updates after unmount)
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ── Central alert + log emitter ──────────────────────────────────────────────
  const fireAlert = useCallback((
    type: string,
    description: string,
    severity: "low" | "medium" | "high",
    cooldownMs: number,
    extraDetails?: Record<string, any>,
  ) => {
    const now = Date.now();
    const last = cooldowns.current.get(type) ?? 0;
    if (now - last < cooldownMs) return; // within cooldown — skip
    cooldowns.current.set(type, now);

    const details = {
      path: location.pathname,
      timestamp: new Date().toISOString(),
      ...extraDetails,
    };

    // Write to activity_logs for the full audit trail
    logActivity({
      action: type,
      userId: user?.id,
      details,
    }).catch(() => {});

    // Write to security_alerts for admin visibility
    createSecurityAlert({
      user_id: user?.id ?? null,   // ← snake_case to match the DB column
      type,
      description,
      severity,
      resolved: false,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }, [user?.id, location.pathname]);

  // ── 1. getDisplayMedia interception ─────────────────────────────────────────
  // Patches the browser API so we know the instant screen-sharing is started.
  // The patch is restored on unmount so it doesn't bleed into other sessions.
  useEffect(() => {
    if (!navigator.mediaDevices?.getDisplayMedia) return;

    const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getDisplayMedia = async function (
      constraints?: DisplayMediaStreamOptions,
    ) {
      fireAlert(
        "screen_share_detected",
        "Screen sharing or recording initiated via browser getDisplayMedia API",
        "high",
        60_000,
        { method: "getDisplayMedia" },
      );
      return original(constraints);
    };

    return () => {
      // Restore original so we don't permanently patch the browser API
      navigator.mediaDevices.getDisplayMedia = original;
    };
  }, [fireAlert]);

  // ── 2. PrintScreen key detection ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        fireAlert(
          "screenshot_attempt",
          `PrintScreen key pressed${e.ctrlKey ? " (Ctrl)" : e.altKey ? " (Alt)" : ""} — possible screenshot`,
          "medium",
          15_000,
          { key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey },
        );
      }
    };

    document.addEventListener("keyup", handleKeyUp);
    return () => document.removeEventListener("keyup", handleKeyUp);
  }, [fireAlert]);

  // ── 3. Visibility change burst detection ────────────────────────────────────
  // External screen recorders (OBS, Loom, etc.) and browser extensions often
  // cause the tab's visibility to flicker more than a normal user would.
  useEffect(() => {
    const handleVisibility = () => {
      const now = Date.now();
      visTimestamps.current.push(now);
      // Keep only changes within the last 20 seconds
      visTimestamps.current = visTimestamps.current.filter(t => now - t < 20_000);

      if (visTimestamps.current.length >= 6) {
        fireAlert(
          "screen_recording_suspected",
          `Rapid visibility changes detected (${visTimestamps.current.length}× in 20 s) — possible external screen recorder`,
          "medium",
          60_000,
          { changeCount: visTimestamps.current.length },
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fireAlert]);

  // ── 4. DevTools detection ────────────────────────────────────────────────────
  // When DevTools is docked (side or bottom), window.outer* significantly
  // exceeds window.inner*. We check on every resize event.
  useEffect(() => {
    let devtoolsOpen = false;

    const checkDevTools = () => {
      const widthGap  = window.outerWidth  - window.innerWidth  > 160;
      const heightGap = window.outerHeight - window.innerHeight > 160;
      const isOpen = widthGap || heightGap;

      if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true;
        fireAlert(
          "devtools_opened",
          "Browser developer tools opened — possible attempt to inspect or extract content",
          "low",
          120_000,
          { widthGap: window.outerWidth - window.innerWidth, heightGap: window.outerHeight - window.innerHeight },
        );
      } else if (!isOpen) {
        devtoolsOpen = false;
      }
    };

    window.addEventListener("resize", checkDevTools);
    checkDevTools(); // run once on mount in case DevTools is already open
    return () => window.removeEventListener("resize", checkDevTools);
  }, [fireAlert]);

  // ── 5. Rapid navigation + page-view logging ──────────────────────────────────
  useEffect(() => {
    // Always log every page view for the audit trail
    if (user?.id) {
      logActivity({
        action: "page_view",
        userId: user.id,
        details: { path: location.pathname, timestamp: new Date().toISOString() },
      }).catch(() => {});
    }

    // Rapid navigation detection
    const now = Date.now();
    navTimestamps.current.push(now);
    navTimestamps.current = navTimestamps.current.filter(t => now - t < 10_000);

    if (navTimestamps.current.length > 8 && user?.id) {
      fireAlert(
        "rapid_navigation",
        `Rapid navigation detected: ${navTimestamps.current.length} page changes in 10 s`,
        "low",
        30_000,
        { count: navTimestamps.current.length },
      );
    }
  }, [location.pathname, user?.id, fireAlert]);

  return null; // this component renders nothing — it's a passive monitor
};