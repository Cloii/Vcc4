import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { logActivity, createSecurityAlert } from "../../lib/api";

export const SecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const actionTimestamps = useRef<number[]>([]);
  const visibilityChanges = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Log page views and track rapid navigation — errors are silently swallowed
  // because these are background telemetry calls that should never surface to the user.
  useEffect(() => {
    if (user) {
      logActivity({
        action: "page_view",
        userId: user.id,
        details: { path: location.pathname, timestamp: new Date().toISOString() },
      }).catch(() => {}); // silently ignore — telemetry is non-critical
    }

    // Track rapid navigation
    const now = Date.now();
    actionTimestamps.current.push(now);
    actionTimestamps.current = actionTimestamps.current.filter(t => now - t < 10000);

    if (actionTimestamps.current.length > 8 && user) {
      createSecurityAlert({
        userId: user.id,
        type: "rapid_navigation",
        description: `Rapid navigation detected: ${actionTimestamps.current.length} actions in 10s`,
        severity: "low",
        resolved: false,
      }).catch(() => {}); // silently ignore
    }
  }, [location.pathname, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      visibilityChanges.current += 1;
      if (visibilityChanges.current > 10 && user) {
        createSecurityAlert({
          userId: user.id,
          type: "screen_recording_suspected",
          description: `Excessive visibility changes detected (${visibilityChanges.current} times) - possible screen recording`,
          severity: "medium",
          resolved: false,
        }).catch(() => {}); // silently ignore
        visibilityChanges.current = 0;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user]);

  return null;
};
