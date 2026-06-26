// 2026-06-26 — 공지사항 관리 화면 (운영자).
//   진입: AdminApp screen === "announcements" / 사이드바 "📢 공지사항".
//   동작:
//     · 목록: 활성 공지 카드 (제목 · 작성일 · 핀 · 삭제).
//     · "+ 새 공지" 모달: 제목 (필수) + 본문 + "핀 고정" 체크 → 발행.
//     · 발행 → admin_publish_announcement RPC → 자동 트리거 → 전체 기사 푸시 (Mig 148).
//     · 핀 토글 / 소프트 삭제 — RPC 즉시 + 목록 갱신.

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Plus, X, Pin, Trash2 } from "lucide-react";
import {
  listAnnouncements,
  publishAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
} from "../../lib/announcementsDb.js";
import { toKstYmd } from "../../utils/dateLabel.js";

export function AnnouncementManageScreen({ t, user, onBack }) {
  const actorId = user?.user_id || user?.userId || user?.id || null;

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);

  const [composing, setComposing] = useState(false);

  const reload = useCallback(() => setTick(v => v + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listAnnouncements().then(res => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error || "불러오기 실패");
        setItems([]);
      } else {
        setItems(res.items);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tick]);

  async function handlePin(item) {
    if (!actorId) { alert("로그인 운영자 확인 실패"); return; }
    const res = await pinAnnouncement({
      id: item.id,
      isPinned: !item.is_pinned,
      actorId,
    });
    if (!res.ok) { alert(res.error || "핀 변경 실패"); return; }
    reload();
  }

  async function handleDelete(item) {
    if (!actorId) { alert("로그인 운영자 확인 실패"); return; }
    if (!confirm(`"${item.title}" 공지를 삭제할까요?`)) return;
    const res = await deleteAnnouncement({ id: item.id, actorId });
    if (!res.ok) { alert(res.error || "삭제 실패"); return; }
    reload();
  }

  return (
    <div style={containerStyle(t)}>
      <Header t={t} onBack={onBack} count={items.length}/>

      <div style={bodyStyle(t)}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setComposing(true)}
            disabled={!actorId}
            style={{
              padding: "10px 16px",
              background: actorId ? t.accent : t.border,
              color: "#fff",
              border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 800,
              cursor: actorId ? "pointer" : "default",
              fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={16}/> 새 공지
          </button>
        </div>

        {loading ? (
          <Empty t={t}>불러오는 중...</Empty>
        ) : error ? (
          <Empty t={t}>⚠️ {error}</Empty>
        ) : items.length === 0 ? (
          <Empty t={t}>등록된 공지가 없습니다</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => (
              <AnnouncementCard
                key={item.id}
                t={t}
                item={item}
                onTogglePin={() => handlePin(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </div>

      {composing && (
        <ComposeModal
          t={t}
          actorId={actorId}
          onClose={() => setComposing(false)}
          onPublished={() => { setComposing(false); reload(); }}
        />
      )}
    </div>
  );
}

function AnnouncementCard({ t, item, onTogglePin, onDelete }) {
  const dateLabel = toKstYmd(item.published_at || item.created_at) || "—";
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${item.is_pinned ? t.accent : t.border}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginBottom: 4,
          }}>
            {item.is_pinned && (
              <span style={{ fontSize: 12 }}>📌</span>
            )}
            {item.is_popup && (
              <span style={{
                fontSize: 9, fontWeight: 800,
                padding: "2px 6px", borderRadius: 4,
                background: t.accent, color: "#fff",
                letterSpacing: 0.3,
              }}>POPUP</span>
            )}
            <span style={{
              fontSize: 14, fontWeight: 800, color: t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, minWidth: 0,
            }}>{item.title}</span>
          </div>
          {item.body && (
            <div style={{
              fontSize: 12, color: t.textSecondary, fontWeight: 500,
              whiteSpace: "pre-wrap", marginBottom: 6,
              lineHeight: 1.5,
            }}>{item.body}</div>
          )}
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
            {dateLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={item.is_pinned ? "핀 해제" : "핀 고정"}
            title={item.is_pinned ? "핀 해제" : "핀 고정"}
            style={iconBtnStyle(t, item.is_pinned)}
          >
            <Pin size={14}/>
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="삭제"
            title="삭제"
            style={iconBtnStyle(t, false)}
          >
            <Trash2 size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposeModal({ t, actorId, onClose, onPublished }) {
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isPopup, setIsPopup]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    function handler(e) { if (e.key === "Escape" && !submitting) onClose(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  async function handleSubmit() {
    if (!title.trim()) { setError("제목을 입력하세요"); return; }
    if (!actorId)      { setError("로그인 운영자 확인 실패"); return; }
    setSubmitting(true);
    setError("");
    const res = await publishAnnouncement({
      title:    title.trim(),
      body:     body.trim() || null,
      isPinned,
      isPopup,
      actorId,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error || "발행 실패"); return; }
    onPublished?.();
  }

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{
          background: t.bg, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: 14,
          width: "min(560px, 100%)",
          maxHeight: "min(85vh, 700px)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Pretendard', sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 20px",
          borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: t.text }}>
            📢 새 공지 작성
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            aria-label="닫기"
            style={{
              background: "transparent", border: "none", padding: 6,
              cursor: submitting ? "default" : "pointer", color: t.text,
              display: "flex", alignItems: "center",
            }}
          ><X size={20}/></button>
        </div>
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "18px 20px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div>
            <label style={labelStyle(t)}>제목 <span style={{ color: t.accent }}>*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              autoFocus
              placeholder="예: 6/28 (토) 휴무 안내"
              style={inputStyle(t)}
            />
          </div>
          <div>
            <label style={labelStyle(t)}>본문</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="공지 내용 (선택)"
              style={{ ...inputStyle(t), resize: "vertical", minHeight: 120, fontFamily: "inherit" }}
            />
            <div style={{
              fontSize: 10, color: t.textMuted, fontWeight: 600,
              textAlign: "right", marginTop: 4,
            }}>{body.length} / 2000</div>
          </div>
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer",
            fontSize: 13, color: t.text, fontWeight: 600,
          }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: t.accent }}
            />
            📌 핀 고정 (목록 상단 표시)
          </label>
          <label style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            cursor: "pointer",
            fontSize: 13, color: t.text, fontWeight: 600,
          }}>
            <input
              type="checkbox"
              checked={isPopup}
              onChange={(e) => setIsPopup(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: t.accent, marginTop: 2 }}
            />
            <span>
              💬 팝업으로 띄우기
              <div style={{ fontSize: 10, color: t.textSecondary, fontWeight: 500, marginTop: 2 }}>
                기사 앱 진입 시 자동 표시 (한 번 보면 그 기사 폰에서 다시 안 뜸)
              </div>
            </span>
          </label>
          {error && (
            <div style={{
              padding: "10px 12px",
              background: "rgba(255,27,141,0.1)",
              border: `1px solid ${t.accent}`,
              borderRadius: 8,
              color: t.accent,
              fontSize: 12, fontWeight: 700,
            }}>⚠️ {error}</div>
          )}
        </div>
        <div style={{
          display: "flex", gap: 8,
          padding: "14px 20px",
          borderTop: `1px solid ${t.border}`,
        }}>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            style={{
              flex: 1, padding: "12px 0",
              background: t.bgSecondary || t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              color: t.textSecondary,
              fontSize: 13, fontWeight: 700,
              cursor: submitting ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >취소</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            style={{
              flex: 2, padding: "12px 0",
              background: (submitting || !title.trim()) ? t.border : t.accent,
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14, fontWeight: 800,
              cursor: (submitting || !title.trim()) ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >{submitting ? "발행 중..." : "📢 발행 (전체 기사 푸시)"}</button>
        </div>
      </div>
    </div>
  );
}

function Header({ t, onBack, count }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: t.accent,
      color: "#fff",
      flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 6,
            fontFamily: "inherit",
            display: "flex", alignItems: "center",
            flexShrink: 0,
          }}
          aria-label="뒤로"
        ><ArrowLeft size={16}/></button>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.85)",
          marginBottom: 3, fontWeight: 500,
        }}>
          운영자 → 전체 기사
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
        }}>📢 공지사항</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>활성</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{count.toLocaleString()}건</div>
      </div>
    </div>
  );
}

function Empty({ t, children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: t.textSecondary, fontSize: 12,
      background: t.bgElevated,
      border: `1px dashed ${t.border}`,
      borderRadius: 10,
    }}>{children}</div>
  );
}

function iconBtnStyle(t, active) {
  return {
    padding: 6,
    background: active ? t.accent : t.bgElevated,
    border: `1px solid ${active ? t.accent : t.border}`,
    borderRadius: 6,
    color: active ? "#fff" : t.textSecondary,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit",
  };
}

function labelStyle(t) {
  return {
    display: "block",
    fontSize: 12, fontWeight: 700, color: t.textSecondary,
    marginBottom: 6,
  };
}

function inputStyle(t) {
  return {
    width: "100%",
    padding: "10px 12px",
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 13, fontWeight: 500,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };
}

function containerStyle(t) {
  return {
    minHeight: "100vh",
    background: t.bg,
    color: t.text,
    fontFamily: "-apple-system, 'Pretendard', sans-serif",
    display: "flex", flexDirection: "column",
    overflowX: "hidden",
  };
}

function bodyStyle(t) {
  return {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: 16, paddingBottom: 40,
    background: t.bgSecondary || t.bg,
  };
}

export default AnnouncementManageScreen;
