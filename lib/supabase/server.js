import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use this inside Server Components, Route Handlers (app/api/**/route.js),
// and Server Actions. It reads/writes the auth cookie so the user's session
// carries over from the browser.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Next.js patches the global fetch() and caches GET requests made
      // during server rendering by default. Supabase's reads are GET
      // requests too, so without this, a page can silently re-render with
      // a cached response even right after the data changed — this is the
      // actual root cause behind "Something else?" appearing to do
      // nothing. Forcing no-store makes every Supabase read genuinely
      // fresh, every time.
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component that can't set cookies.
            // Safe to ignore — middleware refreshes the session instead.
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  );
}
