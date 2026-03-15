import React, { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { logActivity, createSecurityAlert } from "../../lib/api";

export const SecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const actionTimestamps = useRef<number[]>([]);
  const visibilityChanges = useRef(0);

  useEffect(() => {
    // Log page view
    if (user) {
      logActivity({
        action: "page_view",
        userId: user.id,
        details: { path: window.location.pathname, timestamp: new Date().toISOString() },
      }).catch(console.error);
    }

    // Track rapid navigation
    const now = Date.now();
    actionTimestamps.current.push(now);
    // Keep only last 10 seconds
    actionTimestamps.current = actionTimestamps.current.filter(t => now - t < 10000);

    if (actionTimestamps.current.length > 8 && user) {
      createSecurityAlert({
        userId: user.id,
        type: "rapid_navigation",
        description: `Rapid navigation detected: ${actionTimestamps.current.length} actions in 10s`,
        severity: "low",
        resolved: false,
      }).catch(console.error);
    }
  }, [window.location.pathname, user]);

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
        }).catch(console.error);
        visibilityChanges.current = 0;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user]);

  return null;
};