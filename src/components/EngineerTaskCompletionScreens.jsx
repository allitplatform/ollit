// V14 — 작업 완료 분기 3가지 (완료 / 부분 완료 / 출장비만)
// 정산 요약 카드 일관 (수수료 흐름 표시) / 사장님 catch 14개 반영

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { VISIT_FEE, VISIT_REASONS } from "../data/visitFee.js";
import { getWorkTypeColors } from "../utils/workTypeColors.js";

// V14 — 수수료율 30% 고정 (시뮬 / 시트 연동 시 동적으로)
const FEE_RATE = 0.30;

const PARTIAL_REASONS = [
  { id: "customer_change", label: "고객 요청 변경" },
  { id: "device_bad",      label: "기기 상태 불량 (작업 불가)" },
  { id: "time_short",      label: "시간 부족 (다음 일정)" },
  { id: "other",           label: "기타 (메모 작성)" },
];

// ───────────────────────────────────────────────
// 공통 헤더
// ───────────────────────────────────────────────
function ScreenHeader({ title, onBack }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "14px 16px",
      borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 10,
      background: "var(--bg-primary)",
    }}>
      <button onClick={onBack} style={{
        background: "transparent", border: "none",
        color: "var(--text-primary)", padding: 4,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center",
      }}>
        <ArrowLeft size={20}/>
      </button>
      <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>
        {title}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// V14 — 고객 카드 (좌측 4px 작업 종류 색 바)
// ───────────────────────────────────────────────
function CustomerCard({ task, accentColor, subText }) {
  const colors = getWorkTypeColors(task.workType);
  return (
    <div style={{
      margin: "16px",
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 18,
      padding: "18px 18px 16px 22px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* 좌측 4px 작업 종류 색 바 */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: colors.main,
      }}/>
      <div style={{
        fontSize: 22, fontWeight: 600,
        color: "var(--text-primary)",
        letterSpacing: "-0.3px",
        marginBottom: 6,
      }}>
        {task.customer || "—"} 고객님
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 14, fontWeight: 600,
      }}>
        <span style={{ color: colors.main, fontWeight: 600 }}>
          {colors.icon} {colors.name}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          {task.appliance ? `· ${task.appliance}` : ""}{task.qty ? ` ×${task.qty}대` : ""}
        </span>
      </div>
      {subText && (
        <div style={{
          marginTop: 8,
          fontSize: 13, fontWeight: 600,
          color: accentColor,
        }}>
          {subText}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// V14 — 정산 요약 카드 (위계 정리 + weight 500/600 + 진한 회색 톤)
// ───────────────────────────────────────────────
function SettlementCard({ rows, finalLabel, finalAmount, finalColor }) {
  const dividerIdx = rows.findIndex(r => r.divider);
  const mainRows = dividerIdx >= 0 ? rows.slice(0, dividerIdx) : rows;
  const subRows  = dividerIdx >= 0 ? rows.slice(dividerIdx + 1) : [];

  return (
    <div style={{
      margin: "0 16px 14px",
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: 18,
    }}>
      <div style={{
        fontSize: 14, fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: 16,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 15 }}>💰</span> 정산 요약
      </div>

      {/* 메인 정보 (큰 글자 / 라벨 500 / 금액 600) */}
      {mainRows.map((r, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "5px 0",
          fontSize: 14,
        }}>
          <span style={{
            color: "var(--label-main)",
            fontWeight: 600,
          }}>
            {r.label}
          </span>
          <span style={{
            color: r.color || "var(--text-primary)",
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {r.value}
          </span>
        </div>
      ))}

      {/* 보조 정보 (회색 박스) */}
      {subRows.length > 0 && (
        <div style={{
          background: "var(--sub-box-bg)",
          borderRadius: 11,
          padding: "12px 14px",
          margin: "14px 0",
        }}>
          {subRows.map((r, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "3px 0",
              fontSize: 13,
            }}>
              <span style={{
                color: "var(--label-sub)",
                fontWeight: 600,
              }}>
                {r.label}
              </span>
              <span style={{
                color: r.color || "var(--sub-box-amount)",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
              }}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hero — 내 수익 (핑크 박스) */}
      <div style={{
        background: "var(--hero-pink-bg)",
        border: "1px solid var(--hero-pink-border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex", justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{
          fontSize: 14, color: finalColor,
          fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 15 }}>💰</span> {finalLabel.replace(/^💰\s*/, "")}
        </div>
        <span style={{
          fontSize: 30, color: finalColor,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "-0.7px", lineHeight: 1,
        }}>
          +{finalAmount.toLocaleString("ko-KR")}원
        </span>
      </div>
    </div>
  );
}

function SettlementRow({ label, value, color, strike, divider, bold }) {
  if (divider) {
    return <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }}/>;
  }
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "baseline", padding: "3px 0",
    }}>
      <span style={{
        fontSize: 13,
        color: strike ? "var(--text-tertiary)" : "var(--text-secondary)",
        fontWeight: bold ? 700 : 500,
        textDecoration: strike ? "line-through" : "none",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        color: strike ? "var(--text-tertiary)" : (color || "var(--text-primary)"),
        fontWeight: bold ? 800 : 600,
        textDecoration: strike ? "line-through" : "none",
      }}>
        {value}
      </span>
    </div>
  );
}

// ───────────────────────────────────────────────
// 사유 라디오 리스트
// ───────────────────────────────────────────────
function ReasonRadioList({ reasons, selectedId, onChange, accentColor, label }) {
  return (
    <div style={{ margin: "0 16px 14px" }}>
      <div style={{
        fontSize: 14, fontWeight: 800, marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {reasons.map((r, i) => (
          <ReasonRow
            key={r.id}
            reason={r}
            selected={selectedId === r.id}
            onClick={() => onChange(r.id)}
            accentColor={accentColor}
            isLast={i === reasons.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function ReasonRow({ reason, selected, onClick, accentColor, isLast }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 14px",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        cursor: "pointer",
        background: selected ? `${accentColor}11` : "transparent",
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        border: `2px solid ${selected ? accentColor : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {selected && (
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            background: accentColor,
          }}/>
        )}
      </div>
      <div style={{
        fontSize: 15, fontWeight: selected ? 700 : 600,
        color: selected ? accentColor : "var(--text-primary)",
      }}>
        {reason.label}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// 메모 textarea
// ───────────────────────────────────────────────
function MemoBox({ value, onChange, label }) {
  return (
    <div style={{ margin: "0 16px 14px" }}>
      <div style={{
        fontSize: 14, fontWeight: 800, marginBottom: 10,
      }}>
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="특이사항 / 추가 정보 (선택)"
        style={{
          width: "100%", minHeight: 80,
          padding: 14,
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text-primary)",
          fontSize: 14, fontWeight: 700,
          fontFamily: "inherit",
          resize: "vertical", outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────
// 메인 풀폭 액션 버튼
// ───────────────────────────────────────────────
function MainAction({ label, color, onClick, disabled }) {
  return (
    <div style={{ padding: "14px 16px 24px" }}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: "100%", padding: 16,
          background: disabled ? "var(--bg-secondary)" : color,
          border: "none", borderRadius: 12,
          color: disabled ? "var(--text-tertiary)" : "#fff",
          fontSize: 17, fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 1. 작업 완료 (핑크)
// ═══════════════════════════════════════════════════════
export function TaskCompleteScreen({ task, photos = [], onBack, onConfirm }) {
  const [memo, setMemo] = useState("");
  const baseAmount = task.estimateTotal || 0;
  const extraFee   = task.extraFee || 0;
  const total      = baseAmount + extraFee;
  // V14 — 수수료 30% 고정 (task.commissionRate 무시)
  const rate       = FEE_RATE;
  const commission = Math.floor(total * rate);
  const earning    = Math.max(0, total - commission);

  function handleConfirm() {
    onConfirm && onConfirm({
      type: "complete",
      memo,
      total, commission, earning,
      photos: photos.length,
    });
  }

  return (
    <Container>
      <ScreenHeader title="✓ 작업 완료" onBack={onBack}/>
      <CustomerCard task={task} accentColor="#FF1B8D"/>
      <SettlementCard
        rows={[
          { label: "금액",       value: `${baseAmount.toLocaleString("ko-KR")}원` },
          { label: "현장추가금", value: `${extraFee.toLocaleString("ko-KR")}원` },
          { divider: true },
          { label: "총 작업비", value: `${total.toLocaleString("ko-KR")}원`, bold: true },
          { label: `수수료 (${Math.round(rate * 100)}%)`, value: `-${commission.toLocaleString("ko-KR")}원`, color: "#FF3B5C" },
        ]}
        finalLabel="💰 내 수익"
        finalAmount={earning}
        finalColor="#FF1B8D"
      />
      <MemoBox label="📝 마무리 메모 (선택)" value={memo} onChange={setMemo}/>
      <MainAction label="✓ 완료 처리" color="#FF1B8D" onClick={handleConfirm}/>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════
// 2. V14 헌법 — 부분 완료 (회색 / 중립) — 수량 +/- 카운터
// ═══════════════════════════════════════════════════════
export function TaskPartialScreen({ task, photos = [], onBack, onConfirm }) {
  const totalQty = task.qty || 1;
  const [actualQty, setActualQty] = useState(Math.max(1, totalQty - 1));
  const [reasonId, setReasonId]   = useState("customer_change");
  const [memo, setMemo]           = useState("");

  // 수량 비례 계산
  const baseAmountFull = task.estimateTotal || 0;
  const baseAmount     = totalQty > 0 ? Math.round(baseAmountFull * (actualQty / totalQty)) : 0;
  const extraFee       = task.extraFee || 0;
  const total          = baseAmount + extraFee;
  // V14 — 수수료 30% 고정
  const rate           = FEE_RATE;
  const commission     = Math.floor(total * rate);
  const earning        = Math.max(0, total - commission);

  const canSubmit = !!reasonId && actualQty > 0 && actualQty <= totalQty;

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm && onConfirm({
      type: "partial",
      actualQty, totalQty,
      reasonId, memo,
      total, commission, earning,
      photos: photos.length,
    });
  }

  return (
    <Container>
      <ScreenHeader title="● 부분 완료" onBack={onBack}/>
      <CustomerCard
        task={task}
        accentColor="#888"
        subText={`의뢰: ${task.workType || ""} ×${totalQty}대`}
      />

      {/* 실 작업 수량 카운터 */}
      <div style={{ margin: "0 16px 14px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
          🔢 실 작업 수량
        </div>
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <CounterBtn
            label="−"
            disabled={actualQty <= 1}
            onClick={() => setActualQty(q => Math.max(1, q - 1))}
          />
          <div style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{
              fontSize: 32, fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}>
              {actualQty}
            </div>
            <div style={{
              fontSize: 13, color: "var(--text-secondary)",
              fontWeight: 700, marginTop: 4,
            }}>
              {actualQty}대 / {totalQty}대
            </div>
          </div>
          <CounterBtn
            label="+"
            disabled={actualQty >= totalQty}
            onClick={() => setActualQty(q => Math.min(totalQty, q + 1))}
          />
        </div>
      </div>

      <ReasonRadioList
        reasons={PARTIAL_REASONS}
        selectedId={reasonId}
        onChange={setReasonId}
        accentColor="#888"
        label="⚠️ 부분 완료 사유 (필수)"
      />

      <SettlementCard
        rows={[
          { label: `의뢰 ${totalQty}대 (${baseAmountFull.toLocaleString("ko-KR")}원)`, value: `${baseAmountFull.toLocaleString("ko-KR")}원`, strike: true },
          { label: `금액 (${actualQty}대)`, value: `${baseAmount.toLocaleString("ko-KR")}원` },
          { label: "현장추가금",          value: `${extraFee.toLocaleString("ko-KR")}원` },
          { divider: true },
          { label: "총 작업비",            value: `${total.toLocaleString("ko-KR")}원`, bold: true },
          { label: `수수료 (${Math.round(rate * 100)}%)`, value: `-${commission.toLocaleString("ko-KR")}원`, color: "#FF3B5C" },
        ]}
        finalLabel="💰 내 수익"
        finalAmount={earning}
        finalColor="#FF1B8D"
      />

      {reasonId === "other" && (
        <MemoBox label="📝 사유 메모" value={memo} onChange={setMemo}/>
      )}

      <MainAction
        label="● 부분 완료 처리"
        color="#888"
        onClick={handleConfirm}
        disabled={!canSubmit}
      />
    </Container>
  );
}

function CounterBtn({ label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 56, height: 56, borderRadius: 12,
      background: disabled ? "var(--bg-tertiary)" : "#C8C8C8",
      border: "none",
      color: disabled ? "var(--text-tertiary)" : "#1A1A1A",
      fontSize: 28, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      opacity: disabled ? 0.5 : 1,
    }}>
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════
// 3. 출장비만 (빨강)
// ═══════════════════════════════════════════════════════
export function TaskVisitOnlyScreen({ task, photos = [], onBack, onConfirm }) {
  const [reasonId, setReasonId] = useState(VISIT_REASONS[0]?.id || "");
  const [memo, setMemo]         = useState("");

  const fee     = VISIT_FEE.amount || 30000;
  const earning = fee; // 100% 기사 / 수수료 0
  const canSubmit = !!reasonId;

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm && onConfirm({
      type: "visit_only",
      reasonId, memo,
      fee, earning,
      photos: photos.length,
    });
  }

  return (
    <Container>
      <ScreenHeader title="● 출장비만" onBack={onBack}/>
      <CustomerCard
        task={task}
        accentColor="#FF3B5C"
        subText="작업 불가 (출장비만 청구)"
      />

      <SettlementCard
        rows={[
          { label: "출장비",   value: `${fee.toLocaleString("ko-KR")}원` },
          { divider: true },
          { label: "총 작업비", value: `${fee.toLocaleString("ko-KR")}원`, bold: true },
          { label: "수수료",   value: "0원 (X)", color: "#03C75A" },
        ]}
        finalLabel="💰 내 수익"
        finalAmount={earning}
        finalColor="#FF1B8D"
      />

      <ReasonRadioList
        reasons={VISIT_REASONS}
        selectedId={reasonId}
        onChange={setReasonId}
        accentColor="#FF3B5C"
        label="⚠️ 작업 불가 사유 (필수)"
      />

      {/* 사진 안내 */}
      <div style={{
        margin: "0 16px 14px",
        padding: "12px 14px",
        background: "rgba(255,184,0,0.10)",
        border: "1px solid rgba(255,184,0,0.30)",
        borderRadius: 10,
        fontSize: 13, fontWeight: 600, lineHeight: 1.5,
        color: "var(--text-primary)",
      }}>
        💡 <strong>사진 권장</strong> (CS 대비). 사진 없이도 처리 가능.
        {photos.length > 0 && (
          <span style={{ color: "#03C75A", fontWeight: 700, marginLeft: 6 }}>
            · {photos.length}장 첨부됨 ✓
          </span>
        )}
      </div>

      {reasonId === "other" && (
        <MemoBox label="📝 사유 메모" value={memo} onChange={setMemo}/>
      )}

      <MainAction
        label="● 출장비만 처리"
        color="#FF3B5C"
        onClick={handleConfirm}
        disabled={!canSubmit}
      />
    </Container>
  );
}

// ───────────────────────────────────────────────
// 컨테이너
// ───────────────────────────────────────────────
function Container({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
      paddingBottom: 8,
    }}>
      {children}
    </div>
  );
}
