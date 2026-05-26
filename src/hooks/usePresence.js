import { useEffect, useRef, useState } from "react";
import { CLOUD_ENABLED, trackPresence } from "../lib/supabase";

/**
 * Tracks and broadcasts the current user's presence on a workbook.
 * Returns array of online users (including self).
 */
export function usePresence(workbookId, user) {
  const [online, setOnline] = useState([]);
  const trackerRef = useRef(null);

  useEffect(() => {
    if (!CLOUD_ENABLED || !user || !workbookId) return;

    const tracker = trackPresence(workbookId, {
      id:         user.id,
      name:       user.user_metadata?.name ?? user.email ?? "Anonymous",
      avatar_url: user.user_metadata?.avatar_url ?? null,
      email:      user.email,
      page:       window.location.hash,
    });
    trackerRef.current = tracker;

    tracker.onSync((users) => {
      setOnline(users.filter((u) => u.id !== user.id));
    });

    tracker.channel?.subscribe();

    return () => tracker.untrack();
  }, [workbookId, user?.id]);

  return online;
}
