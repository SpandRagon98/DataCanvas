/**
 * VirtualDashboardItem — viewport-aware dashboard item wrapper.
 *
 * Uses IntersectionObserver to detect visibility:
 *  - Not yet seen:   renders a skeleton placeholder (same size, no chart work)
 *  - Visible:        renders real children
 *  - Scrolled away:  hides children via visibility:hidden (keeps layout, frees GPU)
 *
 * The 200px rootMargin pre-fetches content just before it enters the viewport,
 * eliminating visible pop-in for normal scroll speeds.
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../styles/theme";

export default function VirtualDashboardItem({
  className = "",
  style = {},
  children,
  // Item title shown in skeleton
  title = "",
  // Click handler forwarded from Dashboard (needed for tile selection)
  onClick,
}) {
  const T        = useTheme();
  const ref      = useRef(null);
  const [visible,  setVisible]  = useState(false);
  const [everSeen, setEverSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Early out: if IntersectionObserver is unsupported, always render
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      setEverSeen(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          setEverSeen(true);
        } else {
          setVisible(false);
        }
      },
      {
        rootMargin: "200px 0px",
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={style} onClick={onClick}>
      {everSeen ? (
        /*
         * Once seen, keep children mounted (avoids chart re-init on scroll back).
         * Just toggle visibility so off-screen charts don't paint.
         * IMPORTANT: display:flex + flexDirection:column must be forwarded so that
         * flex-1 children (the chart area) can correctly claim remaining height.
         */
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            visibility: visible ? "visible" : "hidden",
            contentVisibility: visible ? "visible" : "hidden",
          }}
        >
          {children}
        </div>
      ) : (
        /* Skeleton placeholder while waiting for first intersection */
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Skeleton header */}
          <div
            className="border-b px-4 py-2.5 shrink-0"
            style={{ borderColor: T.border }}
          >
            {title ? (
              <div className="text-sm font-semibold truncate" style={{ color: T.muted }}>
                {title}
              </div>
            ) : (
              <div
                className="h-3.5 w-32 rounded"
                style={{ background: T.s3 }}
              />
            )}
          </div>
          {/* Skeleton chart area with shimmer */}
          <div
            className="flex-1 rounded-b-xl overflow-hidden relative"
            style={{ background: T.s2 }}
          >
            {/* Shimmer bar */}
            <div
              className="absolute inset-0 -translate-x-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
                animation: "shimmer 1.8s infinite",
              }}
            />
            {/* Ghost bars */}
            <div className="flex items-end gap-3 px-6 pb-6 h-full">
              {[60, 80, 45, 90, 70, 55, 85, 40].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: T.s3,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
