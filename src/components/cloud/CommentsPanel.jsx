import { useEffect, useRef, useState } from "react";
import {
  MessageSquare, X, Send, CheckCircle2, Circle,
  CornerDownRight, AtSign, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  CLOUD_ENABLED, getComments, addComment, addReply,
  resolveComment, deleteComment,
} from "../../lib/supabase";
import { useTheme } from "../../styles/theme";

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name, size = 24 }) {
  const COLORS = ["#f59e0b","#60a5fa","#34d399","#f472b6","#a78bfa"];
  const color  = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];
  const init   = (name ?? "?")[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ width: size, height: size, background: color, color: "#000" }}
    >
      {init}
    </div>
  );
}

// ── ReplyItem ────────────────────────────────────────────────────────────────

function ReplyItem({ reply, T }) {
  return (
    <div className="flex gap-2 pl-6 pt-1.5">
      <CornerDownRight size={11} style={{ color: T.muted, marginTop: 3, flexShrink: 0 }} />
      <Avatar name={reply.author_name} size={18} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: T.text }}>{reply.author_name}</span>
          <span className="text-[10px]" style={{ color: T.muted }}>{timeAgo(reply.created_at)}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: T.dim }}>
          {reply.body}
        </p>
      </div>
    </div>
  );
}

// ── CommentItem ──────────────────────────────────────────────────────────────

function CommentItem({ comment, user, onResolve, onDelete, T }) {
  const [expanded,    setExpanded]    = useState(true);
  const [replyOpen,   setReplyOpen]   = useState(false);
  const [replyText,   setReplyText]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const canAct = user && CLOUD_ENABLED;

  const handleReply = async () => {
    if (!replyText.trim() || !canAct) return;
    setSubmitting(true);
    await addReply(comment.id, {
      author_id:   user.id,
      author_name: user.user_metadata?.name ?? user.email ?? "Anonymous",
      body: replyText.trim(),
    });
    setReplyText("");
    setReplyOpen(false);
    setSubmitting(false);
  };

  const resolved = Boolean(comment.resolved_at);

  return (
    <div
      className="rounded-lg border"
      style={{
        background: resolved ? "rgba(16,185,129,0.04)" : T.s2,
        borderColor: resolved ? "rgba(16,185,129,0.18)" : T.border,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-1">
        <Avatar name={comment.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] font-semibold" style={{ color: T.text }}>{comment.author_name}</span>
            {comment.visual_id && (
              <span
                className="rounded px-1 py-px text-[9px] font-medium uppercase"
                style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
              >
                visual
              </span>
            )}
            <span className="text-[10px]" style={{ color: T.muted }}>{timeAgo(comment.created_at)}</span>
            {resolved && (
              <span
                className="rounded px-1 py-px text-[9px] font-medium"
                style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
              >
                resolved
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: T.dim }}>
            {comment.body}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {(comment.replies ?? []).length > 0 && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="rounded p-0.5"
              style={{ color: T.muted }}
              title="Toggle replies"
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
          {canAct && !resolved && (
            <button
              onClick={() => onResolve(comment.id)}
              className="rounded p-0.5"
              style={{ color: "#10b981" }}
              title="Mark resolved"
            >
              <CheckCircle2 size={12} />
            </button>
          )}
          {canAct && resolved && (
            <button
              onClick={() => onResolve(comment.id)}
              className="rounded p-0.5"
              style={{ color: T.muted }}
              title="Re-open"
            >
              <Circle size={12} />
            </button>
          )}
          {canAct && (
            <button
              onClick={() => onDelete(comment.id)}
              className="rounded p-0.5"
              style={{ color: T.muted }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {expanded && (comment.replies ?? []).length > 0 && (
        <div className="pb-1.5 space-y-0.5">
          {comment.replies.map((r) => <ReplyItem key={r.id} reply={r} T={T} />)}
        </div>
      )}

      {/* Reply bar */}
      <div className="border-t px-3 py-2" style={{ borderColor: T.border }}>
        {replyOpen ? (
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              className="flex-1 resize-none rounded-lg border px-2 py-1.5 text-xs outline-none"
              style={{ background: T.surface, borderColor: T.border, color: T.text }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || submitting}
                className="rounded-lg border px-2 py-1 text-[10px] font-semibold"
                style={{ background: T.accent, color: "#000", borderColor: "transparent", opacity: (!replyText.trim() || submitting) ? 0.5 : 1 }}
              >
                <Send size={10} />
              </button>
              <button
                onClick={() => { setReplyOpen(false); setReplyText(""); }}
                className="rounded-lg border px-2 py-1 text-[10px]"
                style={{ background: T.s3, borderColor: T.border, color: T.muted }}
              >
                <X size={10} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setReplyOpen(true)}
            className="text-[10.5px] font-medium"
            style={{ color: T.muted }}
            disabled={!canAct}
          >
            <CornerDownRight size={10} className="inline mr-1" />
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

// ── CommentsPanel ─────────────────────────────────────────────────────────────

export default function CommentsPanel({ open, onClose, workbookId, user }) {
  const T               = useTheme();
  const [comments,      setComments]     = useState([]);
  const [loading,       setLoading]      = useState(false);
  const [text,          setText]         = useState("");
  const [filter,        setFilter]       = useState("open"); // "open" | "resolved" | "all"
  const [submitting,    setSubmitting]   = useState(false);
  const bottomRef       = useRef(null);

  // Load comments when panel opens
  useEffect(() => {
    if (!open || !workbookId || !CLOUD_ENABLED) return;
    setLoading(true);
    getComments(workbookId).then((data) => {
      setComments(data ?? []);
      setLoading(false);
    });
  }, [open, workbookId]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!text.trim() || !user || !CLOUD_ENABLED || !workbookId) return;
    setSubmitting(true);
    const c = await addComment(workbookId, {
      author_id:   user.id,
      author_name: user.user_metadata?.name ?? user.email ?? "Anonymous",
      body: text.trim(),
      visual_id: null,
    });
    if (c) setComments((prev) => [c, ...prev]);
    setText("");
    setSubmitting(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleResolve = async (id) => {
    if (!CLOUD_ENABLED) return;
    const updated = await resolveComment(id);
    if (updated) {
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, resolved_at: updated.resolved_at } : c));
    }
  };

  const handleDelete = async (id) => {
    if (!CLOUD_ENABLED) return;
    await deleteComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const visible = comments.filter((c) => {
    if (filter === "open")     return !c.resolved_at;
    if (filter === "resolved") return Boolean(c.resolved_at);
    return true;
  });

  const openCount     = comments.filter((c) => !c.resolved_at).length;
  const resolvedCount = comments.filter((c) => c.resolved_at).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-end"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-slide-left flex flex-col"
        style={{
          width: 360,
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: T.accentDim }}>
              <MessageSquare size={13} color={T.accent} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: T.text }}>Comments</div>
              <div className="text-[10.5px]" style={{ color: T.muted }}>
                {openCount} open · {resolvedCount} resolved
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border p-1.5" style={{ background: T.s2, borderColor: T.border, color: T.muted }}>
            <X size={13} />
          </button>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-1 border-b px-4 py-2 shrink-0"
          style={{ borderColor: T.border }}
        >
          {[["open","Open"],["resolved","Resolved"],["all","All"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{
                background: filter === v ? T.accentDim : "transparent",
                color: filter === v ? T.accent : T.muted,
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {!CLOUD_ENABLED && (
            <div
              className="rounded-lg border p-3 text-xs"
              style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.2)", color: T.accent }}
            >
              Cloud not configured. Comments require Supabase.
            </div>
          )}

          {loading ? (
            <div className="text-xs text-center py-8" style={{ color: T.muted }}>Loading…</div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <MessageSquare size={28} style={{ color: T.border }} />
              <div className="text-xs" style={{ color: T.muted }}>
                {filter === "open" ? "No open comments" : filter === "resolved" ? "No resolved comments" : "No comments yet"}
              </div>
            </div>
          ) : (
            visible.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                user={user}
                onResolve={handleResolve}
                onDelete={handleDelete}
                T={T}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        {CLOUD_ENABLED && user && (
          <div
            className="shrink-0 border-t px-3 py-3"
            style={{ borderColor: T.border }}
          >
            <div className="flex items-start gap-2">
              <Avatar name={user.user_metadata?.name ?? user.email} />
              <div className="flex-1">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Comment… (@mention teammates)`}
                  rows={3}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
                  style={{ background: T.s2, borderColor: T.border, color: T.text }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: T.muted }}>
                    <AtSign size={9} /> mention with @name
                  </span>
                  <button
                    onClick={handleAdd}
                    disabled={!text.trim() || submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: T.accent, color: "#000", opacity: (!text.trim() || submitting) ? 0.5 : 1 }}
                  >
                    <Send size={10} />
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {CLOUD_ENABLED && !user && (
          <div
            className="shrink-0 border-t px-4 py-3 text-xs text-center"
            style={{ borderColor: T.border, color: T.muted }}
          >
            Sign in to post comments
          </div>
        )}
      </div>
    </div>
  );
}
