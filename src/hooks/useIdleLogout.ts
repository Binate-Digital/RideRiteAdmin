import { useEffect } from "react";
import { lastActivity, touchActivity } from "@/lib/session";
import { logoutAdmin } from "@/lib/api";

/** Minutes of inactivity before the admin is signed out (TRD 6.1 session expiry). */
export const IDLE_MINUTES = Math.max(1, Number(import.meta.env.VITE_ADMIN_IDLE_MINUTES) || 15);

const EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;

/**
 * Signs the admin out after IDLE_MINUTES without input. Activity is shared through
 * localStorage, so working in one tab keeps the other tabs signed in too.
 */
export function useIdleLogout(onLogout: () => void) {
  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      // Throttle writes (mousemove fires constantly)
      if (now - last > 5000) {
        last = now;
        touchActivity(now);
      }
    };
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    touchActivity();
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity() >= IDLE_MINUTES * 60000) {
        void logoutAdmin("idle").finally(onLogout);
      }
    }, 15000);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
      window.clearInterval(timer);
    };
  }, [onLogout]);
}
