import { useTheme } from "../../styles/theme";

const COLORS = ["var(--dc-accent)","#60a5fa","#34d399","#f472b6","#a78bfa","#fb923c"];

function Avatar({ user, index, size = 26 }) {
  const color = COLORS[index % COLORS.length];
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      title={`${user.name ?? user.email} is online`}
      className="relative inline-flex items-center justify-center rounded-full border-2 text-[10px] font-bold"
      style={{
        width: size, height: size,
        background: color,
        borderColor: "var(--dc-surface)",
        color: "#000",
        marginLeft: index > 0 ? -6 : 0,
        zIndex: 10 - index,
      }}
    >
      {user.avatar_url
        ? <img src={user.avatar_url} alt={initials} className="h-full w-full rounded-full object-cover" />
        : initials
      }
      {/* Online dot */}
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-current"
        style={{ background: "#22c55e", borderColor: "var(--dc-surface)" }}
      />
    </div>
  );
}

export default function PresenceBar({ online }) {
  const T = useTheme();
  if (!online?.length) return null;

  const visible = online.slice(0, 5);
  const extra   = online.length - 5;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {visible.map((u, i) => <Avatar key={u.id ?? i} user={u} index={i} />)}
        {extra > 0 && (
          <div
            className="inline-flex items-center justify-center rounded-full border-2 text-[10px] font-bold"
            style={{ width: 26, height: 26, background: T.s2, borderColor: T.border, color: T.dim, marginLeft: -6 }}
          >
            +{extra}
          </div>
        )}
      </div>
      <span className="text-[11px]" style={{ color: T.muted }}>
        {online.length} online
      </span>
    </div>
  );
}
