/**
 * SplashScreen — first-load welcome screen.
 *
 * Shows the Vizora logo (soft pulse), a personalized welcome message, and a
 * subtle progress bar for ~3s, then calls onDone. Shown once per browser
 * session (the parent guards with sessionStorage) so it never appears during
 * normal navigation.
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
      const pct = Math.min(100, ((Date.now() - start) / DURATION) * 100);
      setProgress(pct);
    }, 30);
    const done = setTimeout(() => onDone?.(), DURATION);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [onDone]);

  const isLight = T.text === "#0f172a" || T.surface === "#ffffff";
  const bg = isLight
    ? "radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #ecfdf7 60%, #e6f5f3 100%)"
    : "radial-gradient(120% 120% at 50% 0%, #0b1120 0%, #0a0f1a 60%, #070b12 100%)";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: bg }}
    >
      {/* Greeting */}
      <div
        className="mb-7 text-center"
        style={{ animation: "splashFade 700ms ease both" }}
      >
        <div className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>
          {greeting}
        </div>
        <div className="mt-1 text-sm" style={{ color: T.muted }}>
          {APP_TAGLINE}
        </div>
      </div>

      {/* Logo with soft pulse + glow ring */}
      <div className="relative flex items-center justify-center" style={{ width: 132, height: 132 }}>
        <div
          className="absolute inset-0 rounded-3xl"
          style={{
            background: "radial-gradient(circle, rgba(20,184,166,0.25), transparent 70%)",
            animation: "splashPulse 2s ease-in-out infinite",
          }}
        />
        <div
          className="relative flex items-center justify-center rounded-3xl"
          style={{
            width: 104, height: 104,
            background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
            boxShadow: isLight
              ? "0 12px 40px rgba(20,184,166,0.18), 0 2px 8px rgba(15,23,42,0.06)"
              : "0 12px 48px rgba(20,184,166,0.28)",
            border: `1px solid ${isLight ? "rgba(20,184,166,0.18)" : "rgba(255,255,255,0.08)"}`,
            animation: "splashLogo 2s ease-in-out infinite",
          }}
        >
          <Logo size={64} />
        </div>
      </div>

      {/* Wordmark */}
      <div className="mt-6 text-3xl font-extrabold tracking-tight" style={{ color: T.text, letterSpacing: "-0.02em" }}>
        {APP_NAME}
      </div>

      {/* Progress bar */}
      <div className="mt-8 h-1 w-56 overflow-hidden rounded-full" style={{ background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #2563eb, #14b8a6)",
            transition: "width 60ms linear",
          }}
        />
      </div>

      <style>{`
        @keyframes splashFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes splashPulse { 0%,100% { transform: scale(0.9); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 1; } }
        @keyframes splashLogo { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      `}</style>
    </div>
  );
}
