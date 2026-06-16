// 2026-06-03 — Phase 2a: 운영자 "냉매 미처리" 별도 화면 (목록 표시만, 쓰기 0).
//   tasks.category_data.refrigerant_addon (processed=false) 항목 측측.
//   Phase 1 측측 기사 PWA 측측 세척 완료 측 입력. Phase 2b 측측 측측 [냉매 작업 만들기] 측측 측측.
//
// 사장님 spec:
//   카드 = 고객명 / 지역 / 기사명 / 기종 / 받은 현금 / 원본 완료일 / 원본 task_no / 라우팅 측측.
//   라우팅: principalCode==='usol_n' → "usol_h로 생성" / 측측 → "{원청} 그대로".
//   정렬: 완료일 오래된 순 (빠뜨림 측측).
//   [냉매 작업 만들기] 측측 측측 자리 — 측측 측측 (2b 측측 측측).
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { fetchUnprocessedRefriAddons, previewRefrigerantSplit, createRefrigerantTaskFromAddon, modifyRefrigerantAddon } from "../../lib/refrigerantAddonsDb.js";
// 2026-06-16 — PC(1024px+) 진입 시 헤더 백버튼 숨김 (사이드바 메뉴로 이동).
import { useIsPc } from "../../utils/useIsPc.js";

const APPLIANCE_OPTIONS = ["벽걸이", "스탠드", "투인원", "4way", "1way"];

function fmtKstDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // KST 변환 후 YYYY-MM-DD HH:mm
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${h}:${mi}`;
}

function fmtKRW(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function RefrigerantAddonListScreen({ t, onBack, onTaskClick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  // 2026-06-16 — PC에선 사이드바 메뉴 진입이라 백버튼 무의미. 모바일에선 그대로.
  const isPc = useIsPc();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchUnprocessedRefriAddons()
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "조회 실패");
          setItems([]);
        } else {
          setItems(res.items || []);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadTick]);

  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + (Number(it.addon_amount) || 0), 0),
    [items]
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        {!isPc && (
          <button onClick={onBack} style={{
            background: "transparent", border: "none", padding: 4,
            cursor: "pointer", color: t.text,
            display: "flex", alignItems: "center",
          }}>
            <ArrowLeft size={20}/>
          </button>
        )}
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          ⚡ 냉매 미처리
        </div>
        <button
          onClick={() => setReloadTick(v => v + 1)}
          disabled={loading}
          style={{
            background: "transparent", border: "none", padding: 6,
            cursor: loading ? "default" : "pointer", color: t.textMuted,
            display: "flex", alignItems: "center",
          }}
          aria-label="새로고침"
        >
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* 요약 */}
      <div style={{ padding: "14px 16px 8px" }}>
        <div style={{
          background: "rgba(255,184,0,0.08)",
          border: "1px solid rgba(255,184,0,0.30)",
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ fontSize: 12, color: t.text, fontWeight: 700, lineHeight: 1.5 }}>
            기사 PWA에서 세척 완료 때 같이 입력한 냉매충전입니다.<br/>
            아직 별도 작업으로 만들지 않은 항목만 보입니다.
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>합계</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: "#FFB800" }}>
              {fmtKRW(totalAmount)}
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
              {items.length}건
            </div>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div style={{ padding: "8px 16px" }}>
        {loading ? (
          <EmptyBox t={t}>불러오는 중...</EmptyBox>
        ) : error ? (
          <EmptyBox t={t}><span style={{ color: t.danger || "#EF4444" }}>⚠️ {error}</span></EmptyBox>
        ) : items.length === 0 ? (
          <EmptyBox t={t}>✓ 미처리 냉매충전 0건.</EmptyBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(it => (
              <RefriCard
                key={it.id}
                t={t}
                item={it}
                onClickTask={() => onTaskClick && onTaskClick(it)}
                onProcessed={() => setReloadTick(v => v + 1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RefriCard({ t, item, onClickTask, onProcessed }) {
  const isUsolN = item.principal_code === "usol_n";
  // 2026-06-03 — Phase 2b-1: 분배 미리보기 RPC.
  //   라우팅 측 원청(routed_principal_code) 측측 호출. RPC 실패/함수 측측 측측 측측 측측 (—).
  //   카드 mount 측 1회 측측.
  const [preview, setPreview] = useState(null);
  const [previewState, setPreviewState] = useState("loading"); // 'loading' | 'ok' | 'fail'
  // 2026-06-03 — Phase 2b-2: [냉매 작업 만들기] busy state (per-card).
  const [busy, setBusy] = useState(false);
  // 2026-06-03 — Phase 2c: 수정 인라인 펼침 + 입력 state.
  const [editing, setEditing]       = useState(false);
  const [editAmount, setEditAmount] = useState(String(item.addon_amount || ""));
  const [editAppl, setEditAppl]     = useState(item.addon_appliance || "벽걸이");
  const [editBusy, setEditBusy]     = useState(false);

  async function handleEditSave() {
    if (editBusy) return;
    const n = Number(editAmount);
    if (!editAmount || !Number.isFinite(n) || n <= 0) {
      alert("금액을 올바르게 입력해 주세요.");
      return;
    }
    if (!APPLIANCE_OPTIONS.includes(editAppl)) {
      alert("기종을 선택해 주세요.");
      return;
    }
    setEditBusy(true);
    const res = await modifyRefrigerantAddon({
      sourceTaskId: item.id, action: "edit", amount: n, appliance: editAppl,
    });
    setEditBusy(false);
    if (!res.ok) {
      alert(`수정 실패: ${res.error || "알 수 없는 오류"}`);
      return;
    }
    setEditing(false);
    onProcessed && onProcessed();   // 목록 refetch → 분배 미리보기 자동 재계산
  }

  function handleEditCancel() {
    if (editBusy) return;
    setEditing(false);
    setEditAmount(String(item.addon_amount || ""));
    setEditAppl(item.addon_appliance || "벽걸이");
  }

  async function handleDiscard() {
    if (busy || editBusy) return;
    if (!window.confirm(
      `이 냉매충전 항목을 취소(버림)할까요?\n` +
      `[${item.task_no}] · ${item.addon_appliance} · ₩${(Number(item.addon_amount)||0).toLocaleString("ko-KR")}\n\n` +
      `취소하면 미처리 목록에서 빠지고 작업도 생성되지 않습니다.\n` +
      `(기록은 남아 회계 추적에 사용됩니다.)`
    )) return;
    const res = await modifyRefrigerantAddon({
      sourceTaskId: item.id, action: "cancel",
    });
    if (!res.ok) {
      alert(`취소 실패: ${res.error || "알 수 없는 오류"}`);
      return;
    }
    onProcessed && onProcessed();
  }

  async function handleCreate() {
    if (busy) return;
    if (!preview || previewState !== "ok") {
      alert("분배 미리보기가 준비되지 않아 생성할 수 없어요. 새로고침 후 다시 시도해 주세요.");
      return;
    }
    const fmt = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
    const principalLabel = item.routed_principal_name || item.routed_principal_code || "—";
    const msg = `[${item.task_no}-R] 냉매 작업 생성\n` +
                `원청: ${principalLabel}\n` +
                `기사 ${fmt(preview.engineer)} / 회사 ${fmt(preview.company)} / 원청 ${fmt(preview.principal)}\n\n` +
                `위 내용으로 냉매 작업 생성 + 완료 처리합니다. 진행할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await createRefrigerantTaskFromAddon(item.id);
    setBusy(false);
    if (!res.ok) {
      alert(`생성 실패: ${res.error || "알 수 없는 오류"}`);
      return;
    }
    alert(`✓ ${res.task_no} 생성됨\n기사 ${fmt(res.engineer)} / 회사 ${fmt(res.company)} / 원청 ${fmt(res.principal)} / 트랙 ${res.track}` +
          (res.consent_copied ? "\n동의서 복사 완료" : ""));
    onProcessed && onProcessed();
  }
  useEffect(() => {
    let alive = true;
    setPreviewState("loading");
    previewRefrigerantSplit({
      principalCode: item.routed_principal_code,
      applianceKr:   item.addon_appliance,
      amount:        item.addon_amount,
      engineerId:    item.engineer_id,
    }).then(res => {
      if (!alive) return;
      if (res.ok) {
        setPreview(res);
        setPreviewState("ok");
      } else {
        setPreview(null);
        setPreviewState("fail");
      }
    });
    return () => { alive = false; };
  }, [item.routed_principal_code, item.addon_appliance, item.addon_amount, item.engineer_id]);

  return (
    <div style={{
      background: t.bgElevated || t.bg,
      border: `1px solid ${t.border}`,
      borderLeft: "4px solid #FFB800",
      borderRadius: 12,
      padding: "12px 14px",
    }}>
      {/* 상단: 고객 + 기종 + 금액 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: t.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.customer_name || "—"}
          </div>
          <div style={{
            fontSize: 11, color: t.textMuted, fontWeight: 600,
            marginTop: 2,
          }}>
            {item.district || "—"} · 기사 {item.engineer_name || "—"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(255,184,0,0.12)",
            color: "#B07E00",
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 11, fontWeight: 800,
            marginBottom: 4,
          }}>
            ⚡ {item.addon_appliance || "—"}
          </div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
            {fmtKRW(item.addon_amount)}
          </div>
        </div>
      </div>

      {/* 라우팅 안내 */}
      <div style={{
        fontSize: 11, color: t.textMuted, fontWeight: 600,
        background: isUsolN ? "rgba(3,199,90,0.08)" : t.bgInset || "rgba(255,255,255,0.03)",
        border: `1px solid ${isUsolN ? "rgba(3,199,90,0.25)" : t.border}`,
        borderRadius: 8,
        padding: "6px 10px",
        marginBottom: 8,
      }}>
        {isUsolN
          ? <>소속: <b style={{ color: "#03C75A" }}>유솔홈케어 H</b>로 생성 (usol_n 세척 → usol_h 자동)</>
          : <>소속: <b style={{ color: t.text }}>{item.principal_name || item.principal_code || "—"}</b> 그대로</>
        }
      </div>

      {/* 2026-06-03 — Phase 2b-1: 분배 측측 (read-only preview_refrigerant_split RPC). */}
      <SplitPreview t={t} state={previewState} preview={preview}/>

      {/* 원본 task 정보 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        fontSize: 11, color: t.textMuted, fontWeight: 600,
        paddingTop: 8, borderTop: `1px dashed ${t.border}`,
      }}>
        <button
          type="button"
          onClick={onClickTask}
          style={{
            background: "transparent", border: "none", padding: 0,
            color: t.textMuted, fontSize: 11, fontWeight: 600,
            cursor: onClickTask ? "pointer" : "default",
            fontFamily: "inherit", textAlign: "left",
            textDecoration: onClickTask ? "underline dotted" : "none",
          }}
        >
          📄 원본: {item.task_no || "—"}
        </button>
        <span className="mono">완료 {fmtKstDate(item.completed_at)}</span>
      </div>

      {/* 2026-06-03 — Phase 2c: 인라인 [수정] 펼침 (기종 + 금액 + 저장/취소). */}
      {editing && (
        <div style={{
          background: t.bgInset || "rgba(255,255,255,0.03)",
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          padding: 10,
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>기종</div>
              <select
                value={editAppl}
                onChange={(e) => setEditAppl(e.target.value)}
                disabled={editBusy}
                style={{
                  width: "100%", padding: "7px 10px",
                  background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6,
                  color: t.text, fontSize: 12, fontFamily: "inherit", outline: "none",
                }}
              >
                {APPLIANCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>받은 현금</div>
              <input
                type="number"
                inputMode="numeric"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                disabled={editBusy}
                placeholder="금액 (원)"
                style={{
                  width: "100%", padding: "7px 10px",
                  background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6,
                  color: t.text, fontSize: 12, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={handleEditCancel}
              disabled={editBusy}
              style={{
                flex: 1, padding: "8px 10px",
                background: "transparent",
                border: `1px solid ${t.border}`, borderRadius: 8,
                color: t.textSecondary, fontSize: 12, fontWeight: 700,
                cursor: editBusy ? "default" : "pointer", fontFamily: "inherit",
              }}
            >취소</button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={editBusy}
              style={{
                flex: 1, padding: "8px 10px",
                background: editBusy ? (t.bgInset || "rgba(255,255,255,0.04)") : "#03C75A",
                border: `1px solid ${editBusy ? t.border : "#03C75A"}`, borderRadius: 8,
                color: editBusy ? t.textMuted : "#fff", fontSize: 12, fontWeight: 800,
                cursor: editBusy ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}
            >{editBusy ? "저장 중..." : "저장"}</button>
          </div>
        </div>
      )}

      {/* 2026-06-03 — Phase 2c: 수정/취소 (인라인 펼침 토글) */}
      {!editing && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            style={{
              flex: 1, padding: "7px 10px",
              background: "transparent",
              border: `1px solid ${t.border}`, borderRadius: 8,
              color: t.textSecondary, fontSize: 11, fontWeight: 700,
              cursor: busy ? "default" : "pointer", fontFamily: "inherit",
            }}
          >✏️ 수정</button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={busy}
            style={{
              flex: 1, padding: "7px 10px",
              background: "transparent",
              border: `1px solid ${t.border}`, borderRadius: 8,
              color: t.textSecondary, fontSize: 11, fontWeight: 700,
              cursor: busy ? "default" : "pointer", fontFamily: "inherit",
            }}
          >✕ 버림</button>
        </div>
      )}

      {/* 2026-06-03 — Phase 2b-2: 측측 측측 활성화 (RPC 측측 트랜잭션). */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={busy || previewState !== "ok"}
        title={previewState !== "ok" ? "분배 미리보기 준비 후 다시 시도해 주세요" : "냉매 작업 생성 + 완료"}
        style={{
          width: "100%", marginTop: 10,
          padding: "10px 12px",
          background: busy
            ? (t.bgInset || "rgba(255,255,255,0.04)")
            : (previewState === "ok" ? "#FFB800" : (t.bgInset || "rgba(255,255,255,0.04)")),
          border: `1px solid ${previewState === "ok" && !busy ? "#FFB800" : t.border}`,
          borderRadius: 10,
          color: busy || previewState !== "ok" ? t.textMuted : "#1A1A1A",
          fontSize: 12, fontWeight: 800,
          cursor: busy || previewState !== "ok" ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {busy ? "생성 중..." : "🛠️ 냉매 작업 만들기"}
      </button>
    </div>
  );
}

// 2026-06-03 — Phase 2b-1: 분배 측측 측측.
//   ok 측측 측측 "기사 ₩X / 회사 ₩Y / 원청 ₩Z" + refrigerant_rate 표시.
//   loading 측측 측측 / fail 측측 측측 측측 측측 "—" 표시 (= 측측 측측 측측 측측).
function SplitPreview({ t, state, preview }) {
  if (state === "loading") {
    return (
      <div style={previewBoxStyle(t)}>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>분배 미리보기</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginLeft: 8 }}>불러오는 중...</span>
      </div>
    );
  }
  if (state === "fail" || !preview) {
    return (
      <div style={previewBoxStyle(t)}>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>분배 미리보기</span>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginLeft: 8 }}>
          — (불러오기 실패: SQL 설치 필요)
        </span>
      </div>
    );
  }
  return (
    <div style={previewBoxStyle(t)}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6, gap: 8,
      }}>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>
          분배 미리보기
        </span>
        <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 600 }}>
          {preview.calc_method || "—"} · 기사 rate {preview.refrigerant_rate}%
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <SplitPill t={t} label="기사" amount={preview.engineer} color="#03C75A"/>
        <SplitPill t={t} label="회사" amount={preview.company}  color={t.accent}/>
        <SplitPill t={t} label="원청" amount={preview.principal} color="#FFB800"/>
      </div>
    </div>
  );
}

function previewBoxStyle(t) {
  return {
    background: t.bgInset || "rgba(255,255,255,0.03)",
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 8,
  };
}

function SplitPill({ t, label, amount, color }) {
  return (
    <div style={{
      flex: 1,
      background: t.bg || "transparent",
      border: `1px solid ${t.border}`,
      borderRadius: 6,
      padding: "6px 8px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 800, color }}>
        ₩{(Number(amount) || 0).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

function EmptyBox({ t, children }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      color: t.textMuted, fontSize: 13,
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
    }}>
      {children}
    </div>
  );
}

export default RefrigerantAddonListScreen;
