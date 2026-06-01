/**
 * SplashScreen — first-load welcome screen.
 *
 * Clean Vizora logo (no container/box), a large non-bold welcome message,
 * wordmark, and a subtle progress bar for ~3s, then calls onDone. Shown once
 * per browser session (parent guards with sessionStorage).
 */
import { useEffect, useState } from "react";
import { useTheme } from "../styles/theme";
import { APP_NAME, APP_TAGLINE } from "../branding";
import Logo from "./Logo";

const DURATION = 3000;

function resolveGreeting(user) {
  const name = user?.user_metadata?.name || user?.name || "";
  if (name && name.trim()) {
    const first = name.trim().split(/\s+/)[0];
    return `Welcome, ${first}`;
  }
  return `Welcome to ${APP_NAME}`;
}

export default function SplashScreen({ user, onDone }) {
  const T = useTheme();
  const [progress, setProgress] = useState(0);
  const greeting = resolveGreeting(user);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - start) / DURATION) * 100));
    }, 30);
    const done = setTimeout(() => onDone?.(), DURATION);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [onDone]);

  const isLight = T.surface === "#ffffff";
  const bg = isLight
    ? "radial-gradient(130% 130% at 50% 0%, #ffffff 0%, #f3f7fb 70%, #eef2f7 100%)"
    : "radial-gradient(130% 130% at 50% 0%, #0c1320 0%, #0a0f19 65%, #070a11 100%)";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: bg }}
    >
      {/* Greeting — large, clean, NOT bold */}
      <div className="mb-9 text-center" style={{ animation: "splashFade 700ms ease both" }}>
        <div
          className="tracking-tight"
          style={{ color: T.text, fontSize: "2.4rem", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.01em" }}
        >
          {greeting}
        </div>
        <div className="mt-2" style={{ color: T.muted, fontSize: "1rem", fontWeight: 400 }}>
          {APP_TAGLINE}
        </div>
      </div>

      {/* Clean logo — no box, gentle pulse */}
      <Logo size={104} style={{ animation: "splashLogo 2.4s ease-in-out infinite" }} />

      {/* Wordmark */}
      <div className="mt-6 tracking-tight" style={{ color: T.text, fontSize: "1.9rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
        {APP_NAME}
      </div>

      {/* Progress bar */}
      <div className="mt-8 h-1 w-56 overflow-hidden rounded-full"
        style={{ background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2563eb, #14b8a6)", transition: "width 60ms linear" }} />
      </div>

      <style>{`
        @keyframes splashFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes splashLogo { 0%,100% { transform: scale(1); opacity: 0.92; } 50% { transform: scale(1.07); opacity: 1; } }
      `}</style>
    </div>
  );
}
