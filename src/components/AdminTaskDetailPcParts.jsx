// 2026-10-07 — 운영자 PC 작업 상세 개편 1차 (시안 v2). 배치 · 묶음만 바꾼다 — 저장 함수 · 계산은 건드리지 않는다.
//   usePanelWidth    : 상세 패널의 실제 폭 (2단 / 1단 판단)
//   PcStatusStrip    : 맨 위 — 한 줄 요약(일정 · 담당 · 결제 · 지역) + 진행 막대 + 지금 할 일 버튼
//   PcCustomerCard   : 고객 — 이름 · 연락처 · 요청사항(노란 상자)
//   PcPlaceCard      : 장소 — 주소 블록 (이전설치면 철거 / 설치 두 블록 + 설치 주소 수정)
//   PcExceptionCard  : 예외 처리 (빨간 테두리) — 출장비만 정산 · 품목별 취소 · 작업 전체 취소 · 오접수
//   PcSection        : 제목 + 내용 묶음 (금액 · 수행 · 변경 이력)
import { useEffect, useRef, useState } from "react";
import { PAYMENT_METHOD_LABELS } from "../data/paymentMethods.js";
import { engineerDisplayName } from "../lib/subcontractorsDb.js";
import { formatDateTimeKST } from "../utils/dateLabel.js";
import { isRelocationTask, relocationLine, mapSearchLinks, mapAppLinks } from "../utils/relocation.js";
import { RelocationBlocks } from "./RelocationParts.jsx";
import { splitAddress, addressHead } from "../utils/addressParts.js";

const GUT = 12;
const cardBox = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px",
  margin: `0 ${GUT}px 12px`,
};
const cardTitle = { fontSize: 13, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const smallBtn = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px",
  fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};

// 완료 전인가 (받은 돈을 아직 입력하지 않는 단계): 미배정 · 배정 · 일정 확정.
//   단, 일정 확정인데 일정 시각이 이미 지났으면 완료 전으로 보지 않는다 (운영자가 대신 마무리할 수 있게).
export function isBeforeWork(task) {
  const s = String(task?.status || "");
  if (!["미배정", "약속대기", "배정", "확정", "접수"].includes(s)) return false;
  if (s === "확정") {
    const at = task.scheduledAt || task.scheduled_at;
    const ts = at ? new Date(at).getTime() : NaN;
    if (!isNaN(ts) && ts <= Date.now()) return false;
  }
  return true;
}

export function usePanelWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setW(el.getBoundingClientRect().width || 0);
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// 상태 → 진행 단계 번호 (0 접수 · 1 배정 · 2 일정 확정 · 3 진행 · 4 완료)
function stageOfTask(task) {
  const s = String(task?.status || "");
  if (s === "완료" || s === "정산완료" || s === "visit_only") return 4;
  if (s === "진행중" || s === "작업중" || s === "이동중") return 3;
  if (s === "확정") return 2;
  if (s === "배정" || s === "약속대기") return 1;
  return 0;
}
function whenText(task) {
  const at = task.scheduledAt || task.scheduled_at;
  if (at) return formatDateTimeKST(at);
  const rd = String(task.requestedDate || "").slice(0, 10);
  if (rd) return `희망 ${rd.slice(5).replace("-", "/")}${task.requestedTime ? ` ${String(task.requestedTime).slice(0, 5)}` : ""}`;
  return "일정 미정";
}

//   embedded: 맨 위 카드 안에 넣을 때 (자기 카드 테두리 없이)
//   mobile: 좁은 화면 — 지금 할 일 버튼 한 줄(같은 폭) + 통화 · 문자 한 줄, 지역은 구·동
export function PcStatusStrip({ task, embedded = false, mobile = false, canceled = false, onAssign, onScheduleChange, onComplete, onShowMoney, onCall, onMessage, onEngineerCall }) {
  const stage = stageOfTask(task);
  const isSub = !!task.subcontractorId;
  const steps = [
    { label: "접수", at: task.receivedAt || task.createdAt },
    { label: "배정", at: task.assignedAt },
    { label: "일정 확정", at: task.scheduledConfirmedAt },
    { label: "진행", at: task.startedAt },
    { label: "완료", at: task.completedAt },
  ];
  const eng = engineerDisplayName(task, "담당 없음");
  const pay = PAYMENT_METHOD_LABELS[task.paymentMethod] || task.paymentMethod || "결제 미정";
  const area = relocationLine(task) || (mobile ? addressHead(task.fullAddress || task.address || "") : "") || task.region || "";
  const main = {
    border: "none", borderRadius: 10, padding: mobile ? "12px 8px" : "10px 14px", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit",
    cursor: "pointer", background: "var(--accent, #FF1B8D)", color: "#fff", whiteSpace: "nowrap",
    ...(mobile ? { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } : {}),
  };
  const ghost = { ...main, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" };

  const actions = [];
  if (!canceled) {
    if (isSub) {
      if (stage < 3 && onAssign) actions.push(<button key="a" type="button" onClick={onAssign} style={main}>👷 기사 지정 (예외)</button>);
      if (stage < 3 && onScheduleChange) actions.push(<button key="s" type="button" onClick={onScheduleChange} style={ghost}>📅 일정</button>);
      if (stage >= 4 && onShowMoney) actions.push(<button key="m" type="button" onClick={onShowMoney} style={main}>💰 정산 보기</button>);
    } else if (stage === 0) {
      if (onAssign) actions.push(<button key="a" type="button" onClick={onAssign} style={main}>👷 기사 배정</button>);
      if (onScheduleChange) actions.push(<button key="s" type="button" onClick={onScheduleChange} style={ghost}>📅 일정 잡기</button>);
    } else if (stage === 1) {
      if (onScheduleChange) actions.push(<button key="s" type="button" onClick={onScheduleChange} style={main}>📅 일정 잡기</button>);
      if (onAssign) actions.push(<button key="a" type="button" onClick={onAssign} style={ghost}>👷 기사 변경</button>);
    } else if (stage === 2) {
      if (onScheduleChange) actions.push(<button key="s" type="button" onClick={onScheduleChange} style={main}>📅 일정 변경</button>);
      if (onAssign) actions.push(<button key="a" type="button" onClick={onAssign} style={ghost}>👷 기사 변경</button>);
    } else if (stage === 3) {
      if (onComplete) actions.push(<button key="c" type="button" onClick={onComplete} style={main}>✅ 완료 확인</button>);
    } else if (onShowMoney) {
      actions.push(<button key="m" type="button" onClick={onShowMoney} style={main}>💰 정산 보기</button>);
    }
  }

  return (
    <div style={embedded ? { marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" } : { ...cardBox, marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
        <span>📅 {whenText(task)}</span>
        <span>👷 {eng}</span>
        <span>💳 {pay}</span>
        {area && <span>📍 {area}</span>}
      </div>

      {/* 진행 막대 — 지나간 단계는 색칠, 마우스를 올리면 시각 */}
      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        {steps.map((st, i) => {
          const on = !canceled && i <= stage;
          return (
            <div key={st.label} title={st.at ? `${st.label} ${formatDateTimeKST(st.at)}` : st.label} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 6, borderRadius: 3, background: on ? "var(--accent, #FF1B8D)" : "var(--border)" }}/>
              <div style={{ fontSize: 11.5, fontWeight: i === stage && !canceled ? 800 : 600, marginTop: 4, textAlign: "center",
                            color: on ? "var(--text-primary)" : "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {st.label}
              </div>
            </div>
          );
        })}
      </div>
      {canceled && <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--danger, #E5484D)", marginTop: 8 }}>취소된 작업입니다</div>}

      {mobile ? (
        <>
          {actions.length > 0 && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>{actions}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: actions.length > 0 ? 8 : 14 }}>
            {onCall && <button type="button" onClick={onCall} style={ghost}>📞 통화</button>}
            {onMessage && <button type="button" onClick={onMessage} style={ghost}>💬 문자</button>}
            {onEngineerCall && task.engineerPhone && <button type="button" onClick={onEngineerCall} style={ghost}>📞 기사</button>}
          </div>
        </>
      ) : (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {actions}
        {onCall && <button type="button" onClick={onCall} style={ghost}>📞 고객 통화</button>}
        {onMessage && <button type="button" onClick={onMessage} style={ghost}>💬 문자</button>}
        {onEngineerCall && task.engineerPhone && <button type="button" onClick={onEngineerCall} style={ghost}>📞 기사 통화</button>}
      </div>
      )}
    </div>
  );
}

//   children: 요청사항 상자 아래에 넣을 내용 (메모 목록 · [+ 메모 추가])
export function PcCustomerCard({ task, onEdit, children = null }) {
  const note = String(task.requestNote || task.memo || "").trim();
  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 14 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
  return (
    <div style={cardBox}>
      <div style={cardTitle}>
        <span>고객</span>
        {onEdit && <button type="button" onClick={onEdit} style={smallBtn}>수정</button>}
      </div>
      {row("이름", task.customer || "—")}
      {row("연락처", task.phone || "—")}
      {note ? (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.5)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#B45309", marginBottom: 3 }}>📝 요청사항</div>
          <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{note}</div>
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-tertiary)" }}>요청사항 없음</div>
      )}
      {children}
    </div>
  );
}

function openMap(kind, address) {
  const web = mapSearchLinks(address)[kind];
  const app = mapAppLinks(address)[kind];
  const isPhone = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  if (!isPhone || !app) { window.open(web, "_blank"); return; }
  const start = Date.now();
  window.location.href = app;
  setTimeout(() => { if (Date.now() - start < 2000 && document.visibilityState === "visible") window.open(web, "_blank"); }, 1500);
}

export function PcPlaceCard({ task, onSaveDest }) {
  const [copied, setCopied] = useState(false);
  const address = task.fullAddress || task.address || "";
  async function copy() {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (_e) { window.prompt("주소를 복사해 주세요", address); }
  }
  return (
    <div style={cardBox}>
      <div style={cardTitle}><span>장소</span></div>
      {isRelocationTask(task) ? (
        <RelocationBlocks task={task} onSaveDest={onSaveDest}/>
      ) : (
        <>
          {/* 2026-10-07 — 구·동 크게 + 전체 주소 아래 작게 */}
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", wordBreak: "keep-all" }}>{splitAddress(address).head || address || "주소 없음"}</div>
          {splitAddress(address).head && (
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45, wordBreak: "keep-all", overflowWrap: "anywhere", marginTop: 1 }}>{address}</div>
          )}
          {address && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={() => openMap("kakao", address)} style={smallBtn}>카카오맵</button>
              <button type="button" onClick={() => openMap("tmap", address)} style={smallBtn}>티맵</button>
              <button type="button" onClick={() => openMap("naver", address)} style={smallBtn}>네이버지도</button>
              <button type="button" onClick={copy} style={smallBtn}>{copied ? "복사됨 ✓" : "주소 복사"}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 기존 동작을 그대로 부른다: 출장비만 정산 · 작업 전체 취소(사유 입력 창) / 품목별 취소는 금액 카드의 항목 줄에서.
//   children: 협력사 작업의 [변경 요청] [직영으로 회수] (기존 부품)
//   compact: 모바일 — 버튼 4개를 2×2 로
export function PcExceptionCard({ task, onVisitOnly, onCancel, onPartialCancel, children = null, compact = false }) {
  const closed = ["완료", "정산완료", "취소", "visit_only"].includes(String(task.status || ""));
  const item = (emoji, title, desc, onClick, danger) => (
    <button type="button" onClick={onClick} disabled={!onClick} style={{
      display: "flex", alignItems: compact ? "flex-start" : "center", gap: compact ? 7 : 10, width: "100%", textAlign: "left", fontFamily: "inherit",
      cursor: onClick ? "pointer" : "default", opacity: onClick ? 1 : 0.45,
      background: "transparent", border: `1px solid ${danger ? "rgba(229,72,77,0.5)" : "var(--border)"}`, borderRadius: 10,
      padding: compact ? "10px 9px" : "10px 12px", marginBottom: compact ? 0 : 6,
    }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 13.5, color: danger ? "var(--danger, #E5484D)" : "var(--text-primary)" }}>{title}</b>
        <span style={{ fontSize: compact ? 11 : 12, color: "var(--text-secondary)", lineHeight: 1.35, display: "block" }}>{desc}</span>
      </span>
    </button>
  );
  return (
    <div style={{ ...cardBox, borderColor: "rgba(229,72,77,0.55)" }}>
      <div style={cardTitle}>
        <span>⚙️ 예외 처리</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)" }}>{compact ? "누르면 사유 입력" : "드물게 쓰는 기능 · 누르면 사유 입력"}</span>
      </div>
      <div style={compact ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 6, marginBottom: 6 } : undefined}>
      {item("💸", "출장비만 정산", compact ? "갔지만 작업 못 함" : "현장에 갔지만 작업을 못 한 경우", closed ? null : onVisitOnly, false)}
      {item("✂️", "품목별 취소", compact ? "일부 항목만 취소" : "일부 항목만 취소 (예: 설치만 취소)", closed ? null : onPartialCancel, false)}
      {item("🚫", "작업 전체 취소", compact ? "사유 필수" : "사유 필수 · 고객 사정 / 일정 조율 실패 / 현장 불가 / 기타", task.status === "취소" ? null : onCancel, true)}
      {item("🗑", "오접수 처리", compact ? "사유에서 '오접수' 선택" : "실수 접수 · 통계에서 빠짐 (기록은 남음) — 취소 사유에서 '오접수'를 고릅니다", task.status === "취소" ? null : onCancel, true)}
      </div>
      {children}
    </div>
  );
}

// 금액 카드 아래쪽: 기사 · 회사 (협력사 작업이면 협력사 · 수수료 · 원청 몫) 비율 막대 + 자재비 · 부가세 줄.
//   값은 서버가 계산해 둔 정산 값(payments)을 그대로 읽는다. 계산이 아직 없으면 안내만.
//   onEditMaterial: 주면 자재비 줄에 [자재비 입력] 버튼 (설치 작업에서만)
export function PcMoneySplit({ task, onEditMaterial = null }) {
  const won = (n) => `₩${Math.round(Number(n) || 0).toLocaleString("ko-KR")}`;
  const isSub = !!task.subcontractorId;
  const share = Math.max(0, Number(task.sub_principal_share || 0));
  const fee = Number(task.owner_amount || 0);
  let parts;
  if (isSub) {
    const supply = Number(task.supplyAmount || 0) || Number(task.receivedTotal || 0) || 0;
    parts = [
      { label: "협력사", amount: Math.max(0, supply - fee), color: "#A78BFA" },
      { label: "회사 (수수료)", amount: Math.max(0, fee - share), color: "#FF1B8D" },
      { label: "원청 몫", amount: share, color: "#F59E0B" },
    ];
  } else {
    parts = [
      { label: "기사", amount: Number(task.engineer_amount || 0), color: "#06B6D4" },
      { label: "회사", amount: Math.max(0, fee - share), color: "#FF1B8D" },
      { label: "원청", amount: Number(task.principal_amount || 0) + share, color: "#F59E0B" },
    ];
  }
  parts = parts.filter(p => p.amount > 0);
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  const material = Number(task.materialCost || 0);
  const got = Number(task.receivedTotal ?? task.totalAmount ?? 0) || 0;
  const vat = (!isSub && task.vatIncluded === true && got > 0) ? Math.max(0, got - Math.round(got / 1.1)) : 0;
  // 완료 전(접수 · 배정 · 일정 확정)에는 견적 기준으로 계산된 값이라 "예상" 이라고 적는다
  const beforeWork = isBeforeWork(task);
  const isInstall = (() => {
    const wi = Array.isArray(task.workItems) ? task.workItems : [];
    if (wi.length > 0) return wi.every(x => x.serviceCode === "install" || /설치/.test(String(x.workType || x.appliance || "")));
    return /설치/.test(String(task.workType || ""));
  })();
  return (
    <div style={{ marginTop: 12 }}>
      {sum > 0 && beforeWork && (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 5 }}>예상 (견적 기준 — 완료 때 실제 받은 돈으로 확정)</div>
      )}
      {sum > 0 ? (
        <>
          <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--border)" }}>
            {parts.map(p => <div key={p.label} style={{ width: `${(p.amount / sum) * 100}%`, background: p.color }} title={`${p.label} ${won(p.amount)}`}/>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8, fontSize: 13 }}>
            {parts.map(p => (
              <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color }}/>
                <span style={{ color: "var(--text-secondary)" }}>{p.label} {Math.round((p.amount / sum) * 100)}%</span>
                <b style={{ color: "var(--text-primary)" }}>{won(p.amount)}</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>기사 · 회사 분배는 정산이 계산된 뒤에 나옵니다</div>
      )}
      {(material > 0 || (onEditMaterial && isInstall && !isSub)) && (
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>🧰 자재비 {material > 0 ? `${won(material)} (기사 선지출 — 기사 몫에 포함)` : "없음"}</span>
          {onEditMaterial && isInstall && !isSub && (
            <button type="button" onClick={onEditMaterial} style={{ ...smallBtn, padding: "3px 9px", fontSize: 11.5 }}>자재비 입력</button>
          )}
        </div>
      )}
      {vat > 0 && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>🧾 부가세 {won(vat)} (따로 받은 금액 · 어느 몫에도 넣지 않음)</div>}
    </div>
  );
}

// 수행 — 누가 하는지 (상태만). children: 직영 작업을 협력사로 넘기는 기존 카드
export function PcPerformerCard({ task, children = null }) {
  const isSub = !!task.subcontractorId;
  return (
    <div style={cardBox}>
      <div style={cardTitle}><span>수행</span></div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>
        {isSub ? "협력사" : "올데이케어 직영"}
        <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}> · {engineerDisplayName(task, "담당 없음")}</span>
      </div>
      {isSub && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>변경 요청 · 직영으로 회수는 아래 "예외 처리"에 있습니다</div>}
      {children}
    </div>
  );
}

export function PcSection({ title, right = null, children, anchorRef = null, bare = false }) {
  return (
    <div ref={anchorRef} style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-secondary)", margin: `2px ${GUT + 4}px 8px`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>{right}
      </div>
      {bare ? children : <div>{children}</div>}
    </div>
  );
}
