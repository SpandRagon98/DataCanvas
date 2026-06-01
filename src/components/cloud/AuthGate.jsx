import { useEffect, useState } from "react";
import { Cloud, CloudOff, LogOut, User, ChevronDown, X } from "lucide-react";
import { CLOUD_ENABLED, signOut, getSession } from "../../lib/supabase";
import { useTheme } from "../../styles/theme";

/**
 * AuthGate — shown in the sidebar as a compact cloud status widget.
 * If cloud is not configured it shows a subtle "offline" chip.
 * If cloud is configured but user is not signed in, shows "Sign In" button.
 * If user is signed in, shows avatar + name with a dropdown for sign out.
 *
 * It does NOT block the rest of the app — Vizora works fully offline.
 */
export default function AuthGate({ user, onSignIn }) {
  const T         = useTheme();
  const [open,    setOpen]    = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!CLOUD_ENABLED) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
        style={{ background: T.s2, borderColor: T.border }}
      >
        <CloudOff size={12} style={{ color: T.muted, flexShrink: 0 }} />
        <span className="text-[10.5px] truncate" style={{ color: T.muted }}>Cloud offline</span>
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 transition"
        style={{ background: T.s2, borderColor: T.border }}
      >
        <Cloud size={12} style={{ color: T.accent, flexShrink: 0 }} />
        <span className="flex-1 truncate text-[10.5px] font-medium text-left" style={{ color: T.accent }}>
          Sign in to sync
        </span>
      </button>
    );
  }

  const name   = user.user_metadata?.name ?? user.email ?? "User";
  const email  = user.email ?? "";
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5"
        style={{ background: T.s2, borderColor: T.border }}
      >
        {/* Avatar */}
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt={initials}
            className="h-5 w-5 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
            style={{ background: T.accent, color: "#000" }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[10.5px] font-semibold" style={{ color: T.text }}>{name}</div>
        </div>
        <ChevronDown
          size={11}
          style={{
            color: T.muted,
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms",
          }}
        />
      </button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div className="fixed inset-0 z-[98]" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            className="absolute bottom-full left-0 right-0 mb-1 z-[99] rounded-xl border overflow-hidden anim-scale-in"
            style={{ background: T.surface, borderColor: T.border, boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}
          >
            {/* User info */}
            <div className="px-3 py-2.5 border-b" style={{ borderColor: T.border }}>
              <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{name}</div>
              <div className="text-[10px] truncate" style={{ color: T.muted }}>{email}</div>
            </div>

            {/* Status */}
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
              <span className="text-[10.5px]" style={{ color: T.dim }}>Cloud sync active</span>
            </div>

            <div className="border-t" style={{ borderColor: T.border }} />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs"
              style={{ color: "#ef4444" }}
            >
              <LogOut size={12} />
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
