"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// How long with zero interaction before auto sign-out. Tune freely.
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];

// Renders nothing — just watches for activity anywhere in the app and
// signs out after a period of silence. Mounted once in the root layout so
// it applies everywhere a session could be left open, not just one page.
export default function InactivityWatcher() {
  const router = useRouter();
  const timerRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();

    function handleTimeout() {
      supabase.auth.signOut().finally(() => {
        router.push("/login");
        router.refresh();
      });
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS);
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return null;
}
