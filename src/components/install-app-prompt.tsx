"use client";

import { useEffect, useState } from "react";
import { INSTALL_DISMISS_KEY, shouldPromptIosInstall } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const [iosPrompt, setIosPrompt] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setIosPrompt(
      shouldPromptIosInstall({
        userAgent: nav.userAgent,
        platform: nav.platform,
        maxTouchPoints: nav.maxTouchPoints,
        standalone: nav.standalone,
        mediaMatches: window.matchMedia("(display-mode: standalone)").matches,
        dismissed,
      }),
    );

    function onPrompt(event: Event) {
      event.preventDefault();
      if (dismissed) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setIosPrompt(false);
    setInstallEvent(null);
  }

  if (!iosPrompt && !installEvent) return null;

  return (
    <div className={`card border-mint-500/30 ${compact ? "p-3" : "p-5"}`}>
      <p className="text-sm font-semibold">Add to Home Screen</p>
      {iosPrompt ? (
        <p className="muted mt-1">
          On iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It opens like a native
          app, without Safari chrome.
        </p>
      ) : (
        <p className="muted mt-1">Install Panel Treasury as an app shortcut on this device.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {installEvent ? (
          <button
            className="btn-primary"
            onClick={() => {
              void installEvent.prompt();
              dismiss();
            }}
          >
            Install app
          </button>
        ) : null}
        <button className="btn-secondary" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
