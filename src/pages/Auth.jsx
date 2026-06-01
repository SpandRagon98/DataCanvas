import { useState } from "react";
import { Database, Mail, Lock, User, Chrome, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { CLOUD_ENABLED, signInWithEmail, signUpWithEmail, signInWithGoogle } from "../lib/supabase";
import { useLocalAuth } from "../store/useLocalAuth";
import { useTheme } from "../styles/theme";
import Logo from "../components/Logo";
import { APP_NAME, APP_TAGLINE } from "../branding";

export default function Auth({ hideLocalMode = false, onLocalLogin }) {
  const T = useTheme();
  const [tab,        setTab]        = useState("signin");
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");

  const localAuth = useLocalAuth();

  const inputStyle = {
    background: T.s2, borderColor: T.border, color: T.text,
  };

  const reset = () => { setError(""); setSuccess(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      if (CLOUD_ENABLED) {
        // Cloud auth via Supabase
        if (tab === "signin") {
          const { error } = await signInWithEmail(email, password);
          if (error) setError(error.message);
        } else {
          const { error } = await signUpWithEmail(email, password, name);
          if (error) setError(error.message);
          else setSuccess("Check your email to confirm your account!");
        }
      } else {
        // Local auth
        if (tab === "signin") {
          const res = await localAuth.login(email, password);
          if (!res.ok) setError(res.error);
          else onLocalLogin?.();
        } else {
          const res = await localAuth.register(email, name, password);
          if (!res.ok) setError(res.error);
          else {
            // Auto-login after register for owner, show message for others
            const isOwner = email.trim().toLowerCase() === "spandan305@gmail.com";
            if (isOwner) {
              onLocalLogin?.();
            } else {
              setSuccess("Account created! Ask the workspace owner to add you as a member.");
              setTab("signin");
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!CLOUD_ENABLED) {
      setError("Google sign-in requires cloud mode. Use email/password instead.");
      return;
    }
    reset();
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: T.bg }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden"
            style={{ background: "rgba(var(--dc-accent-rgb),0.10)", boxShadow: "0 6px 24px rgba(var(--dc-accent-rgb),0.28)" }}
          >
            <Logo size={40} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tracking-tight" style={{ color: T.text }}>{APP_NAME}</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>{APP_TAGLINE}</div>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border p-6 shadow-xl"
          style={{ background: T.surface, borderColor: T.border }}
        >
          {/* Tab switcher */}
          <div
            className="mb-5 flex rounded-xl border p-1"
            style={{ background: T.s2, borderColor: T.border }}
          >
            {[["signin","Sign In"],["signup","Create Account"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setTab(id); reset(); }}
                className="flex-1 rounded-[9px] py-1.5 text-xs font-semibold transition"
                style={{
                  background: tab === id ? T.surface : "transparent",
                  color: tab === id ? T.text : T.muted,
                  boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
                }}
              >{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "signup" && (
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            )}

            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full rounded-xl border py-2 pl-9 pr-9 text-sm outline-none"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: T.muted }}
              >
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            {error && (
              <div
                className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}
              >
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div
                className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
                style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: T.success }}
              >
                <Check size={12} className="mt-0.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold transition"
              style={{
                background: T.accent,
                color: "#000",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 2px 10px rgba(var(--dc-accent-rgb),0.25)",
              }}
            >
              {loading ? "Please wait..." : tab === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {CLOUD_ENABLED && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 border-t" style={{ borderColor: T.border }} />
                <span className="text-[11px]" style={{ color: T.muted }}>or</span>
                <div className="flex-1 border-t" style={{ borderColor: T.border }} />
              </div>

              <button
                onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border py-2.5 text-sm font-medium transition"
                style={{ background: T.s2, borderColor: T.border, color: T.text }}
              >
                <Chrome size={15} />
                Continue with Google
              </button>
            </>
          )}
        </div>

        {!CLOUD_ENABLED && (
          <p className="mt-4 text-center text-[10.5px] leading-relaxed" style={{ color: T.muted }}>
            Owner account: sign up with your owner email to get full access.
            <br />
            Other users must be added by the workspace owner.
          </p>
        )}

        {!hideLocalMode && CLOUD_ENABLED && (
          <p className="mt-4 text-center text-[11px]" style={{ color: T.muted }}>
            Works offline without an account —{" "}
            <button
              onClick={() => window.location.hash = "/source"}
              className="underline"
              style={{ color: T.accent }}
            >
              continue locally
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
