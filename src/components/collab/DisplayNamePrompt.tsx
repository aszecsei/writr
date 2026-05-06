"use client";

import { useEffect, useRef, useState } from "react";
import { BUTTON_PRIMARY } from "@/components/ui/button-styles";
import {
  buildIdentity,
  GUEST_DEFAULT_NAME,
  readStoredDisplayName,
  writeStoredDisplayName,
} from "@/lib/collab/identity";

interface DisplayNamePromptProps {
  /**
   * Called with the chosen name once the user confirms. The parent should
   * then call `joinAsGuest({ identity })` with the returned identity.
   */
  onSubmit: (identity: { name: string; color: string }) => void;
}

/**
 * Inline prompt rendered before a guest joins a /shared/[uuid] room.
 * Persists the name to localStorage so returning visitors don't see it
 * a second time (the parent should skip rendering when a stored name is
 * already present).
 */
export function DisplayNamePrompt({ onSubmit }: DisplayNamePromptProps) {
  const [name, setName] = useState(() => readStoredDisplayName());
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount. Avoids the autoFocus attribute, which Biome
  // flags for a11y because it can disorient screen-reader users — focusing
  // explicitly here keeps the same UX while letting the page render first.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitted) return;
    setSubmitted(true);
    const identity = buildIdentity({ role: "guest", name });
    writeStoredDisplayName(identity.name);
    onSubmit(identity);
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Join the session
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            What should the host see for your cursor and comments?
          </p>
        </div>
        <label className="block">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Display name
          </span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={GUEST_DEFAULT_NAME}
            maxLength={48}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
        </label>
        <button type="submit" className={`w-full ${BUTTON_PRIMARY}`}>
          Continue
        </button>
      </form>
    </div>
  );
}
