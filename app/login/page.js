"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Family members without a real email address (like a child) get their
// Supabase account created with a synthetic address of the form
// "<username>@<USERNAME_DOMAIN>" — see README "Accounts without email."
// Typing a bare username here (no "@") resolves to that address; typing
// a real email (like the admin's) is used as-is.
const USERNAME_DOMAIN =
  process.env.NEXT_PUBLIC_USERNAME_DOMAIN || "socrates.local";

function resolveIdentifier(identifier) {
  const trimmed = identifier.trim();
  return trimmed.includes("@") ? trimmed : `${trimmed}@${USERNAME_DOMAIN}`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolveIdentifier(identifier),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("That didn't work. Check the spelling and try again.");
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm animate-riseIn">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-mistDim mb-3">
            Project Socrates
          </p>
          <h1 className="font-display italic text-2xl text-paper">
            Make Curiosity a Habit.
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="paper-surface shadow-paper px-8 py-8 flex flex-col gap-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-ink/70">
              Email or username
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-md border border-ink/15 bg-white/70 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-ink/70">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-ink/15 bg-white/70 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-ink text-paper font-body font-semibold py-2.5 hover:bg-ink/90 disabled:opacity-60 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-mistDim mt-6">
          Accounts are set up individually for each family member.
        </p>
      </div>
    </main>
  );
}
