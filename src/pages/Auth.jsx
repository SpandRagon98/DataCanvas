import { useState } from "react";
import { Database, Mail, Lock, User, Chrome, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "../lib/supabase";
import { useTheme } from "../styles/theme";

export default function Auth() {
  const T = useTheme();
  const [tab,        setTab]        = useState("signin");
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");

  const inputStyle = {
    background: T.s2, borderColor: T.border, color: T.text,
  };

  const reset = () => { setError(""); setSuccess(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      if (tab === "signin") {
        const { error } = await signInWithEmail(email, password);
        if (error) setError(error.message);
      } else {
        const { error } = await signUpWithEmail(email, password, name);
        if (error) setError(error.message);
        else setSuccess("Check your email to confirm your account!");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
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
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: T.accent, boxShadow: "0 4px 20px rgba(245,158,11,0.4)" }}
          >
            <Database size={22} color="#000" strokeWidth={2.2} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tracking-tight" style={{ color: T.text }}>DataCanvas</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>BI Workspace</div>
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
                boxShadow: "0 2px 10px rgba(245,158,11,0.25)",
              }}
            >
              {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

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
        </div>

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
      </div>
    </div>
  );
}
