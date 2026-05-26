import { useEffect, useState } from "react";
import { CLOUD_ENABLED, supabase, onAuthChange } from "../lib/supabase";

/**
 * Subscribes to Supabase auth state.
 * Returns { user, session, loading, cloudEnabled }.
 * When CLOUD_ENABLED is false the hook returns cloudEnabled:false and no user.
 */
export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(CLOUD_ENABLED);

  useEffect(() => {
    if (!CLOUD_ENABLED) { setLoading(false); return; }

    // Load current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to changes
    const { data: sub } = onAuthChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  return { user, session, loading, cloudEnabled: CLOUD_ENABLED };
}
