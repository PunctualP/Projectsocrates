"use client";

import { useFormStatus } from "react-dom";

export default function TopicSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-md bg-ink text-paper font-semibold px-5 py-2.5 hover:bg-ink/90 transition disabled:opacity-60"
    >
      {pending ? "Thinking of a question…" : "Get a question →"}
    </button>
  );
}
