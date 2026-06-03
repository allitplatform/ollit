// V14 — 작업 완료 분기 3가지 (완료 / 부분 완료 / 출장비만)
// 정산 요약 카드 일관 (수수료 흐름 표시) / 사장님 catch 14개 반영

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { VISIT_FEE, VISIT_REASONS } from "../data/visitFee.js";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { calculateCommissionMultiRpc, PRINCIPAL_NAME_TO_CODE } from "../lib/commissionPoliciesDb.js";
import { supabase } from "../lib/supabase.js";

// 2026-05-17 — 진행중 상태는 trigger_compute_payment가 발화하지 않아 payments가 stale.
// 완료 확인 화면 mount 시 RPC를 직접 호출해서 재계산 후 payments를 다시 읽어옴.
async function recomputeAndFetchEarning(taskId) {
  const { error: rpcErr } = await supabase.rpc('compute_payment', { p_task_id: taskId });
  if (rpcErr) {
    console.warn('[TaskCompletionScreens] compute_payment 실패:', rpcErr.message);
  }
  const { data, error: selErr } = await supabase
    .from('payments')
    .select('engineer_amount')
    .eq('task_id', taskId)
    .maybeSingle();
  if (selErr) {
    console.warn('[TaskCompletionScreens] payments refetch 실패:', selErr.message);
    return null;
  }
  return data?.engineer_amount ?? null;
}

// principalId (code) → principalName 역변환 박은 spec (catch #8 후속 fix)
const PRINCIPAL_CODE_TO_NAME = Object.fromEntries(
  Object.entries(PRINCIPAL_NAME_TO_CODE).map(([name, code]) => [code, name])
);

// 2026-05-21 — 견적 / 추가 / 총액 요약 카드 (3개 완료 화면 측 측측 측측)
function AmountSummaryCard({ baseAmount = 0, extraFee = 0, accentColor = "#FF1B8D" }) {
  const total = baseAmount + extraFee;
  const isUndecided = baseAmount === 0;
  return (
    <div style={{
      margin: "0 16px 14px",
      padding: "14px",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "var(--text-secondary)",
        letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10,
      }}>
        💰 금액 요약
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SummaryRow
          label="견적"
          value={isUndecided ? "미정 (현장 확정)" : `₩${baseAmount.toLocaleString("ko-KR")}`}
          isItalic={isUndecided}
        />
        <SummaryRow
          label="추가"
          value={`₩${extraFee.toLocaleString("ko-KR")}`}
        />
        <div style={{
          height: 1, background: "var(--border)", margin: "4px 0",
        }}/>
        <SummaryRow
          label="총액"
          value={`₩${total.toLocaleString("ko-KR")}`}
          isBold
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, isBold, isItalic, accentColor }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: isBold ? 14 : 13,
      fontWeight: isBold ? 800 : 600,
    }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span
        className="mono"
        style={{
          color: isBold ? (accentColor || "var(--accent)") : "var(--text-primary)",
          fontStyle: isItalic ? "italic" : "normal",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// 2026-05-30 — Phase B Step 4 — 부분 완료 화면용 받은 돈 입력 + 변화 표시 카드 (신규 흐름).
//   - 견적 합: 부분 취소로 줄어든 경우 (baseAmount < origAmount) 취소선 + 새 값 + ↓ 아이콘
//   - 받은 돈: 사용자 입력 (기본값 = task.receivedTotal 또는 productPrice fallback). 그대로 유지 권장.
//   - 자동 추가금: GREATEST(받은 돈 - 새 견적, 0). 견적 합 줄어든 만큼 자동 증가 → 취소선 + 새 값 + ↑.
//   - 총액: 받은 돈 그대로 (강조 색).
//   DB 동기: 호출처가 task_items 변경 후 apiSetReceivedTotal 로 received_total UPDATE → BEFORE 트리거가 extra_fee 자동 sync.
function PartialReceivedSummary({ baseAmount = 0, origAmount = 0, receivedTotal = "", onReceivedChange, accentColor = "#D4537E" }) {
  const receivedNum  = Number(receivedTotal) || 0;
  const autoExtra    = Math.max(receivedNum - baseAmount, 0);
  const origAutoExtra = Math.max(receivedNum - origAmount, 0);
  const baseChanged  = baseAmount !== origAmount;
  const extraChanged = autoExtra  !== origAutoExtra;

  return (
    <div style={{
      margin: "0 16px 14px",
      padding: 14,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "var(--text-secondary)",
        letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10,
      }}>
        💰 금액 요약
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 견적 합 — 변화 시 취소선 + 새 값 + ↓ */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ color: "var(--text-secondary)" }}>견적 합</span>
          {baseChanged ? (
            <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <s style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>
                ₩{origAmount.toLocaleString("ko-KR")}
              </s>
              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                ₩{baseAmount.toLocaleString("ko-KR")}
              </span>
              <span style={{ color: accentColor, fontSize: 11, fontWeight: 800 }}>↓</span>
            </span>
          ) : (
            <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              ₩{baseAmount.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        {/* 받은 돈 입력 — 사용자 직접 (기본값 진행중 입력값) */}
        <div>
          <div style={{
            fontSize: 11, color: "var(--text-secondary)",
            fontWeight: 700, marginBottom: 4,
          }}>
            받은 돈 (수정 가능)
          </div>
          <input
            type="number"
            inputMode="numeric"
            placeholder="현장에서 받은 돈"
            value={receivedTotal}
            onChange={(e) => onReceivedChange && onReceivedChange(e.target.value)}
            style={{
              width: "100%", padding: 10,
              background: "var(--card-bg)",
              border: `1px solid ${accentColor}`,
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 14, boxSizing: "border-box",
              outline: "none",
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          />
        </div>

        {/* 자동 추가금 — 변화 시 취소선 + 새 값 + ↑ */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ color: "var(--text-secondary)" }}>= 자동 추가금</span>
          {extraChanged ? (
            <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <s style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>
                ₩{origAutoExtra.toLocaleString("ko-KR")}
              </s>
              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                ₩{autoExtra.toLocaleString("ko-KR")}
              </span>
              <span style={{ color: accentColor, fontSize: 11, fontWeight: 800 }}>↑</span>
            </span>
          ) : (
            <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              ₩{autoExtra.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }}/>

        {/* 총액 = 받은 돈 (변경 없음) — 강조 색 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 14, fontWeight: 800,
        }}>
          <span style={{ color: "var(--text-secondary)" }}>총액 = 받은 돈</span>
          <span className="mono" style={{ color: accentColor, fontWeight: 800 }}>
            ₩{receivedNum.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>
    </div>
  );
}

// 2026-05-31 — Phase C Step 5 — 부분 완료 화면 측 메인 2개+ 카드 (counter + 받은 돈 통합).
//   Step 4 (진행중) 의 PerItemReceivedCards 패턴 유사 + counter 버튼 통합.
//   각 카드:
//     · 헤더: 아이콘 + work_type name + appliance ×actQty + counter -/+ + ✗ 취소 배지
//     · 견적 (자동) — qty × unitPrice (counter 측 자동 반영)
//     · 받은 돈 입력 (살아있는 row 측만) + 빠른 입력 + 자동 추가금 (초록 #0F6E56)
//     · 취소 카드 (act=0 또는 wi.isCanceled): 회색 + grayscale + "받은 돈 ₩0"
//   하단 합계 카드: 핑크 #D4537E + 분해 표시.
function PartialPerItemCards({ items = [], actualQtyById = {}, onItemQtyChange, receivedById = {}, onReceivedChange, onAddToItem }) {
  // 합계 (canceled / act=0 제외)
  const sumReceived = items.reduce((s, it) => {
    const act = Number(actualQtyById[it.id] ?? it.qty) || 0;
    if (act === 0 || it.isCanceled) return s;
    return s + (parseInt(receivedById[it.id] || "0", 10) || 0);
  }, 0);
  // 분해 표시 (살아있는 row 측만)
  const breakdown = items
    .filter(it => {
      const act = Number(actualQtyById[it.id] ?? it.qty) || 0;
      return !it.isCanceled && act > 0;
    })
    .map(it => {
      const v  = parseInt(receivedById[it.id] || "0", 10) || 0;
      const wt = getWorkTypeColors(it.workType);
      return `${wt.name} ${v.toLocaleString("ko-KR")}`;
    })
    .join(' + ');

  return (
    <div style={{ padding: "0 16px 14px" }}>
      <div style={{
        fontSize: 14, fontWeight: 800, marginBottom: 10,
      }}>
        🔢 작업 항목별 — 수량 + 받은 돈
      </div>

      {items.length === 0 ? (
        <div style={{
          padding: 14, textAlign: "center",
          color: "var(--text-secondary)", fontSize: 13,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)", borderRadius: 12,
        }}>
          메인 항목이 없습니다.
        </div>
      ) : items.map(it => {
        const ord = Number(it.qty) || 0;
        const act = Number(actualQtyById[it.id] ?? it.qty) || 0;
        const cancelled = act === 0 || !!it.isCanceled;
        const colors    = getWorkTypeColors(it.workType);
        const subtotal  = (Number(it.unitPrice) || 0) * act;
        const value     = receivedById[it.id] != null ? receivedById[it.id] : "";
        const receivedNum = parseInt(value || "0", 10) || 0;
        const autoExtra = Math.max(receivedNum - subtotal, 0);
        const applianceLabel = it.appliance || colors.name;
        const orderTypeLabel = it.orderType || it.order_type || "";

        return (
          <div key={it.id} style={{
            background: "var(--bg-secondary)",
            border: `1px solid ${cancelled ? "var(--border)" : colors.main + '40'}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
            opacity: cancelled ? 0.5 : 1,
            filter: cancelled ? "grayscale(0.3)" : "none",
          }}>
            {/* 헤더 — 아이콘 + name + appliance ×actQty + counter + ✗ */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 18, filter: cancelled ? "grayscale(1)" : "none" }}>{colors.icon}</span>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: cancelled ? "#9CA3AF" : colors.main,
              }}>{colors.name}</span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: cancelled ? "#9CA3AF" : "var(--text-primary)",
                textDecoration: cancelled ? "line-through" : "none",
              }}>
                {applianceLabel}
              </span>
              {orderTypeLabel && (
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>
                  ({orderTypeLabel})
                </span>
              )}
              {/* counter -/+ */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                marginLeft: "auto",
              }}>
                <CounterBtn
                  label="−"
                  size={28}
                  disabled={act <= 0}
                  onClick={() => onItemQtyChange && onItemQtyChange(it.id, Math.max(0, act - 1))}
                />
                <div style={{
                  fontSize: 16, fontWeight: 700, fontFamily: "inherit",
                  color: cancelled ? "var(--text-tertiary)" : "var(--text-primary)",
                  minWidth: 22, textAlign: "center", lineHeight: 1,
                }}>{act}</div>
                <CounterBtn
                  label="+"
                  size={28}
                  disabled={act >= ord}
                  onClick={() => onItemQtyChange && onItemQtyChange(it.id, Math.min(ord, act + 1))}
                />
              </div>
              {cancelled && (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  padding: "1px 6px", borderRadius: 999,
                  background: "#FCEBEB", color: "#A32D2D",
                  whiteSpace: "nowrap",
                }}>✗ 취소</span>
              )}
            </div>

            {/* 견적 (자동, qty 측 반영) */}
            <div style={{
              fontSize: 12, color: "var(--text-secondary)", marginBottom: 8,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontWeight: 600,
            }}>
              <span>견적 (자동, 주문 {ord}대)</span>
              <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                ₩{subtotal.toLocaleString("ko-KR")}
              </span>
            </div>

            {cancelled ? (
              <div style={{
                padding: "8px 10px",
                background: "rgba(156, 163, 175, 0.10)",
                borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                color: "#9CA3AF",
                textAlign: "center",
              }}>
                취소된 항목 — 받은 돈 ₩0
              </div>
            ) : (
              <>
                {/* 받은 돈 입력 */}
                <div style={{
                  fontSize: 11, color: "#D4537E",
                  fontWeight: 800, marginBottom: 4,
                  letterSpacing: 0.3,
                }}>
                  받은 돈
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={value}
                  placeholder={String(subtotal)}
                  onChange={(e) => onReceivedChange && onReceivedChange(it.id, e.target.value)}
                  style={{
                    width: "100%", padding: 10,
                    background: "var(--card-bg)",
                    border: `1px solid ${colors.main}`,
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 15, boxSizing: "border-box",
                    outline: "none", marginBottom: 8,
                    fontFamily: "inherit",
                    fontWeight: 700,
                  }}
                />

                {/* 빠른 입력 */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                  marginBottom: autoExtra > 0 ? 8 : 0,
                }}>
                  {[
                    { amount: 5000,   label: "+5천"  },
                    { amount: 10000,  label: "+1만"  },
                    { amount: 50000,  label: "+5만"  },
                    { amount: 100000, label: "+10만" },
                  ].map(b => (
                    <button
                      key={b.amount}
                      onClick={() => onAddToItem && onAddToItem(it.id, b.amount)}
                      style={{
                        padding: 6,
                        background: "var(--card-bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: colors.main,
                        fontSize: 11, fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* 자동 추가금 — 받은 돈 > 견적 시 초록 안내 */}
                {autoExtra > 0 && (
                  <div style={{
                    padding: "6px 10px",
                    background: "rgba(15, 110, 86, 0.10)",
                    borderRadius: 6,
                    fontSize: 12, fontWeight: 700,
                    color: "#0F6E56",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>= 자동 추가금</span>
                    <span className="mono">₩{autoExtra.toLocaleString("ko-KR")}</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* 합계 카드 — 핑크 강조 */}
      <div style={{
        marginTop: 4, padding: "14px 16px",
        background: "rgba(212, 83, 126, 0.10)",
        border: "1px solid rgba(212, 83, 126, 0.35)",
        borderRadius: 12,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 15, fontWeight: 800,
        }}>
          <span style={{ color: "#D4537E", display: "flex", alignItems: "center", gap: 6 }}>
            💰 총 받은 돈
          </span>
          <span className="mono" style={{ color: "#D4537E", fontSize: 18, letterSpacing: "-0.3px" }}>
            ₩{sumReceived.toLocaleString("ko-KR")}
          </span>
        </div>
        {breakdown && (
          <div style={{
            fontSize: 11, color: "var(--text-secondary)", marginTop: 6, fontWeight: 600,
          }}>
            ({breakdown})
          </div>
        )}
      </div>
    </div>
  );
}

const PARTIAL_REASONS = [
  { id: "customer_change", label: "고객 요청 변경" },
  { id: "device_bad",      label: "기기 상태 불량 (작업 불가)" },
  { id: "time_short",      label: "시간 부족 (다음 일정)" },
  { id: "other",           label: "기타 (메모 작성)" },
];

// 2026-05-25 — 부분취소 사유 라벨 조회 (작업상세 취소 배지용).
//   매핑 없는 키(backfill_qty0 등) → null 반환 → 호출처 측 사유 줄 생략.
export function getPartialReasonLabel(reasonId) {
  if (!reasonId) return null;
  const r = PARTIAL_REASONS.find(x => x.id === reasonId);
  return r?.label || null;
}

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
// V14 v6 — 사장님 Q6: 기사 PWA = 본인 수익만 (수수료/회사이익 X)
// ───────────────────────────────────────────────
function EarningOnlyCard({ amount, color = "#FF1B8D", subText, loading = false }) {
  return (
    <div style={{
      margin: "0 16px 14px",
      background: "var(--card-bg)",
      border: `1.5px solid ${color}`,
      borderRadius: 18,
      padding: "22px 22px 20px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 13, color: "var(--label-main)",
        fontWeight: 700, marginBottom: 10,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <span style={{ fontSize: 15 }}>💰</span> 내 수익
      </div>
      <div style={{
        fontSize: loading ? 20 : 44,
        fontWeight: 700,
        color: loading ? "var(--text-secondary)" : color,
        letterSpacing: loading ? 0 : "-1.5px",
        lineHeight: 1,
        marginBottom: subText ? 10 : 0,
        minHeight: 44,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {loading ? "계산 중..." : `₩${(amount || 0).toLocaleString("ko-KR")}`}
      </div>
      {subText && (
        <div style={{
          fontSize: 12, color: "var(--text-secondary)",
          fontWeight: 600,
        }}>
          {subText}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// V14 — 정산 요약 카드 (위계 정리 + weight 500/600 + 진한 회색 톤)
// 옛 — 운영자 PWA 호환 유지 (기사 PWA는 EarningOnlyCard 사용)
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
            fontFamily: "inherit",
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
                fontFamily: "inherit",
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
          fontFamily: "inherit",
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
        fontFamily: "inherit",
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
  // 2026-06-03 — Phase 1: 세척+냉매충전 2-task. 현장에서 냉매충전(현금) 측측 측측 측측.
  //   ⚠️ "냉매충전"(메인 본작업, 현금, track A 일정산) — usol_n "냉매점검"(추가선택, 네이버 월정산) 아님.
  //   원청 무관 (모든 원청 세척 작업 측측 노출). 측측 측측 냉매 작업(전 workItems serviceCode='refrigerant') 측측 측측.
  //   저장 측측: category_data.refrigerant_addon = { appliance, amount, processed:false }.
  //   ⚠️ task_item/extra_fee 측측 측측 측측 X — Phase 2 측측 측측 usol_h 측측 측측측 측측.
  const refriItems = Array.isArray(task.workItems) ? task.workItems : [];
  const isPureRefrigerant = refriItems.length > 0
    && refriItems.every(wi => wi.serviceCode === 'refrigerant');
  const showRefriAddonToggle = !isPureRefrigerant;
  const [hasRefriAddon, setHasRefriAddon] = useState(false);
  const [refriAppliance, setRefriAppliance] = useState("벽걸이");
  const [refriAmount, setRefriAmount] = useState("");
  const REFRI_APPLIANCE_OPTIONS = ["벽걸이", "스탠드", "투인원", "4way", "1way"];

  const baseAmount = task.estimateTotal || 0;
  const extraFee   = task.extraFee || 0;
  // 2026-05-16 Phase 4 통합 2-D — DB payments 박은 spec (compute_payment v7)
  const total      = baseAmount + extraFee;
  // 2026-05-17 — 진행중 상태에선 trigger가 안 돌아 payments가 stale.
  // mount 시 compute_payment RPC를 직접 호출해서 재계산한 뒤 payments를 refetch.
  const [earning, setEarning] = useState(task.engineer_amount || 0);
  const [earningLoading, setEarningLoading] = useState(false);
  useEffect(() => {
    if (!task.id) return;
    let cancelled = false;
    setEarningLoading(true);
    (async () => {
      try {
        const fresh = await recomputeAndFetchEarning(task.id);
        if (cancelled) return;
        if (fresh != null) {
          setEarning(fresh);
        } else {
          // DB 경로 실패 — client commission 계산으로 최종 fallback
          try {
            const res = await calculateCommissionMultiRpc({
              principalName: task.principal || PRINCIPAL_CODE_TO_NAME[task.principalId] || "",
              workItems:     task.workItems || [],
              totalEstimate: baseAmount,
            });
            if (!cancelled && res?.ok) setEarning(res.engineer || 0);
          } catch (e) { /* fail silent */ }
        }
      } catch (e) {
        console.warn('[TaskCompleteScreen] mount 재계산 예외:', e.message);
      } finally {
        if (!cancelled) setEarningLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [task.id]);
  const commission = Math.max(0, total - earning); // 회사+원청 송금액 (= 수수료 합)

  function handleConfirm() {
    // 2026-06-03 — Phase 1 검증: "예" 측측 금액 0/빈 측측 측측 X.
    if (hasRefriAddon) {
      const n = Number(refriAmount);
      if (!refriAmount || !Number.isFinite(n) || n <= 0) {
        alert("냉매충전 받은 금액을 입력해주세요.");
        return;
      }
    }
    onConfirm && onConfirm({
      type: "complete",
      memo,
      total, commission, earning,
      photos: photos.length,
      // 2026-06-03 — 측측 측측 X 측측 null. 부모 측측 measure 측측 category_data.refrigerant_addon 측측.
      refrigerantAddon: hasRefriAddon
        ? { appliance: refriAppliance, amount: Number(refriAmount) }
        : null,
    });
  }

  return (
    <Container>
      <ScreenHeader title="✓ 작업 완료" onBack={onBack}/>
      <CustomerCard task={task} accentColor="#FF1B8D"/>
      {/* 2026-05-21 — 견적 / 추가 / 총액 요약 (사장님 spec) */}
      <AmountSummaryCard baseAmount={baseAmount} extraFee={extraFee} accentColor="#FF1B8D"/>
      {/* V14 v6 — 사장님 Q6: 기사 PWA = 본인 수익만 (수수료/회사이익 X) */}
      <EarningOnlyCard amount={earning} color="#FF1B8D" loading={earningLoading}/>
      {/* 2026-06-03 — Phase 1: 세척+냉매충전 2-task 토글 (모든 원청 측측 / 측측 냉매 작업 측측). */}
      {showRefriAddonToggle && (
        <RefrigerantAddonCard
          hasAddon={hasRefriAddon}
          setHasAddon={setHasRefriAddon}
          appliance={refriAppliance}
          setAppliance={setRefriAppliance}
          amount={refriAmount}
          setAmount={setRefriAmount}
          applianceOptions={REFRI_APPLIANCE_OPTIONS}
        />
      )}
      <MemoBox label="📝 마무리 메모 (선택)" value={memo} onChange={setMemo}/>
      <MainAction label="✓ 완료 처리" color="#FF1B8D" onClick={handleConfirm}/>
    </Container>
  );
}

// 2026-06-03 — Phase 1: 세척+냉매충전 2-task 입력 카드.
//   "냉매충전도 하셨나요?" 토글 — 측측 "아니오"(접힘).
//   "예" → 펼침: 기종 드롭다운 + 받은 현금 input. 검증은 부모(handleConfirm).
function RefrigerantAddonCard({ hasAddon, setHasAddon, appliance, setAppliance, amount, setAmount, applianceOptions }) {
  return (
    <div style={{ margin: "0 16px 14px" }}>
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
            ⚡ 냉매충전도 하셨나요?
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setHasAddon(false)}
              style={pillStyle(!hasAddon, "#FF1B8D")}
            >아니오</button>
            <button
              type="button"
              onClick={() => setHasAddon(true)}
              style={pillStyle(hasAddon, "#FFB800")}
            >예</button>
          </div>
        </div>

        {hasAddon && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
                기종
              </div>
              <select
                value={appliance}
                onChange={(e) => setAppliance(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  fontSize: 14, fontWeight: 700,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              >
                {applianceOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
                받은 현금
              </div>
              <input
                type="number"
                inputMode="numeric"
                placeholder="현금 받은 금액 (원)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  fontSize: 14, fontWeight: 700,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))", lineHeight: 1.5 }}>
              ℹ️ 완료 처리 시 별도 냉매 작업(현금/일정산)으로 생성됩니다. 기존 세척 정산엔 영향 없음.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pillStyle(active, activeColor) {
  return {
    padding: "6px 14px",
    background: active ? activeColor : "var(--bg-tertiary, rgba(255,255,255,0.04))",
    border: `1px solid ${active ? activeColor : "var(--border)"}`,
    borderRadius: 999,
    color: active ? "#fff" : "var(--text-secondary)",
    fontSize: 12, fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: 56,
  };
}

// ═══════════════════════════════════════════════════════
// 2. V14 헌법 — 부분 완료 — 상품(task_item)별 실 작업 수량 (2026-05-25 개편)
//   사장님 spec: 측 상품별로 측 catch 한 수량 측 catch. 측 catch 수량 측 catch 측 catch. (재방문 X)
// ═══════════════════════════════════════════════════════
export function TaskPartialScreen({ task, photos = [], onBack, onConfirm }) {
  // task.workItems 측 catch — sortedTaskItems 측 catch (tasksDb.rowToTask) → 본작업 우선
  //   각 item: { id (task_item_id), workType, appliance, qty, unitPrice, subtotal, orderType, ... }
  const workItems = Array.isArray(task.workItems) ? task.workItems : [];
  // 2026-05-31 — Phase C Step 5 — 이미 취소된 row (wi.isCanceled=true) 측 init act=0 측 시각 정렬.
  //   PartialCancelDialog 측 사전 취소 케이스 측 진입 시 자동 회색/✗ 표시.
  const [actualQtyById, setActualQtyById] = useState(() => {
    const init = {};
    for (const wi of workItems) {
      init[wi.id] = wi.isCanceled ? 0 : (Number(wi.qty) || 1);
    }
    return init;
  });
  const [reasonId, setReasonId] = useState("customer_change");
  const [memo, setMemo]         = useState("");

  // 2026-05-30 — Phase B Step 4 — 결제 흐름 분기 (Step 3 진행중 화면 분기와 동일)
  //   가드 케이스 (usol_n / payment_method='prepaid') → 옛 흐름 (extraFee 직접 입력 유지).
  //   그 외 → 신규 흐름 (받은 돈 입력 + 자동 추가금 재계산).
  const usesReceivedTotalFlow =
    task.principalCode !== 'usol_n' && task.paymentMethod !== 'prepaid';

  // 2026-05-31 — Phase C Step 5 — 메인 row 분기 (per-item 흐름).
  //   주 (메인) row = order_type 측 '추가선택' 아닌 row.
  //   non-usol_n 측 order_type NULL 측 → 전 row 메인.
  //   2026-05-31 (재변경) — usesPerItemFlow 기준: 원래 메인 개수 (allMainItems.length) 측.
  //     옛 spec: nonCanceledMains.length >= 2 — 중간 취소 시 1개 남으면 옛 화면 측 전환.
  //     새 spec: allMainItems.length >= 2 — 원래 메인 2개+ 측 A화면 (PartialPerItemCards) 유지.
  //     이유: 사용자 측 카운터 측 1개 취소해도 화면 측 그대로 → 시각 안정 (취소 row 측 회색 + 입력칸 숨김).
  //   usol_n / prepaid 측 가드 (usesReceivedTotalFlow=false) 측 옛 흐름 그대로 — 본 변경 측 영향 X.
  const allMainItems = workItems.filter(it => (it.orderType || it.order_type) !== '추가선택');
  const usesPerItemFlow = allMainItems.length >= 2 && usesReceivedTotalFlow;

  // 받은 돈 default — 진행중에서 입력한 값 (task.receivedTotal) > productPrice (fallback)
  const [receivedTotal, setReceivedTotal] = useState(() => {
    if (task.receivedTotal != null) return String(task.receivedTotal);
    const baseline = task.productPrice ?? task.estimateTotal ?? 0;
    return baseline ? String(baseline) : "";
  });

  // 2026-05-31 — Phase C Step 5 — per-item 받은 돈 state.
  //   default = it.receivedAmount > subtotal fallback. 취소된 row 측 "0" 강제.
  const [receivedById, setReceivedById] = useState(() => {
    const init = {};
    for (const it of workItems) {
      if (!it || !it.id) continue;
      if (it.isCanceled) {
        init[it.id] = "0";
      } else if (it.receivedAmount != null) {
        init[it.id] = String(it.receivedAmount);
      } else {
        const sub = Number(it.subtotal) || 0;
        init[it.id] = sub > 0 ? String(sub) : "";
      }
    }
    return init;
  });
  function setReceivedForItem(itemId, value) {
    setReceivedById(prev => ({ ...prev, [itemId]: value }));
  }
  function addReceivedToItem(itemId, amount) {
    setReceivedById(prev => ({
      ...prev,
      [itemId]: String((parseInt(prev[itemId] || "0", 10) || 0) + amount),
    }));
  }

  function setItemQty(itemId, nextQty) {
    setActualQtyById(prev => ({ ...prev, [itemId]: nextQty }));
  }

  // 측 catch 한 작업 합계 = SUM(item.unit_price × actualQty)
  const baseAmount = workItems.reduce((s, wi) => {
    const aq = Number(actualQtyById[wi.id] ?? wi.qty) || 0;
    return s + (Number(wi.unitPrice) || 0) * aq;
  }, 0);
  const extraFee   = task.extraFee || 0;
  // 신규 흐름: 받은 돈 그대로 = 총액, 자동 추가금 = max(received - 새 견적, 0).
  // 옛 흐름: total = baseAmount + extraFee (기존).
  const receivedNum = Number(receivedTotal) || 0;
  // 2026-05-31 — Phase C Step 5 — per-item 합계 받은 돈 (non-canceled main 측만)
  const sumPerItemReceived = allMainItems.reduce((s, it) => {
    const act = Number(actualQtyById[it.id] ?? it.qty) || 0;
    if (act === 0 || it.isCanceled) return s;
    return s + (parseInt(receivedById[it.id] || "0", 10) || 0);
  }, 0);
  // total / autoExtra — 흐름별
  const total = usesPerItemFlow
    ? sumPerItemReceived
    : usesReceivedTotalFlow
      ? receivedNum
      : baseAmount + extraFee;
  const autoExtra = usesPerItemFlow
    ? Math.max(sumPerItemReceived - baseAmount, 0)
    : usesReceivedTotalFlow
      ? Math.max(receivedNum - baseAmount, 0)
      : 0;

  // 옛 비례식 견적 합계 — PartialReceivedSummary 측 변화 표시 측 사용 (유지).
  const origAmount = workItems.reduce((s, wi) => s + (Number(wi.subtotal) || 0), 0);

  // 2026-05-31 — Phase C earning preview 측 RPC override 측 정확 계산 측 교체.
  //   옛: earningFull (payments.engineer_amount) × (baseAmount / origAmount) 비례 — Phase C 측 부정확
  //       (refrigerant_rate × 받은 돈 측 정책 측 비례 X, row 측 독립 계산 측이라).
  //   새: compute_engineer_amount_per_item(p_task_id, p_overrides) RPC (Mig 087) 호출.
  //       p_overrides 측 actualQtyById + receivedById 측 반영 → DB commit 없이 정확 미리보기.
  //       300ms 디바운스 측 빠른 타이핑 측 RPC 측 폭주 차단.
  //       RPC 응답 측 이전 earning 측 유지 (깜빡임 방지).
  const [earning, setEarning]               = useState(Number(task.engineer_amount) || 0);
  const [earningLoading, setEarningLoading] = useState(false);

  // 디바운스 측 + override 측 변경 감지 측 — JSON.stringify 측 deep equality 측 측정
  const overrideKey = JSON.stringify({ q: actualQtyById, r: receivedById });

  useEffect(() => {
    if (!task.id) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      // 모든 row 측 override 측 build (살아있는 + 취소 모두 포함)
      const overrides = workItems
        .filter(wi => wi && wi.id)
        .map(wi => {
          const act = Number(actualQtyById[wi.id] ?? wi.qty) || 0;
          const o = {
            task_item_id: wi.id,
            is_canceled:  act === 0,
            qty:          act,
          };
          // received_amount — 빈 값 측 키 자체 omit (undefined 측 안 됨)
          const raw = receivedById[wi.id];
          if (raw != null && raw !== "") {
            const n = parseInt(raw, 10);
            if (Number.isFinite(n)) o.received_amount = n;
          }
          return o;
        });
      setEarningLoading(true);
      try {
        const { data, error } = await supabase.rpc('compute_engineer_amount_per_item', {
          p_task_id:   task.id,
          p_overrides: overrides,
        });
        if (cancelled) return;
        if (error) {
          console.warn('[TaskPartialScreen] compute_engineer_amount_per_item 실패:', error.message);
          // 깜빡임 방지 측 이전 earning 측 유지 (setEarning 호출 X)
          return;
        }
        const arr = Array.isArray(data) ? data : [];
        const sum = arr.reduce((s, x) => s + (Number(x?.engineer_amount) || 0), 0);
        setEarning(sum);
      } catch (e) {
        console.warn('[TaskPartialScreen] compute_engineer_amount_per_item 예외:', e.message);
      } finally {
        if (!cancelled) setEarningLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // overrideKey 측 actualQtyById + receivedById 측 변경 감지 측 묶음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, overrideKey]);

  // 활성화 조건 — 사유 선택 + 항목 1건 이상 살아있음 + 변경 1건 이상
  const anyPositive = workItems.some(wi => (Number(actualQtyById[wi.id] ?? wi.qty) || 0) > 0);
  // 2026-05-31 — Bug 3 fix — Phase C 측 받은 돈 변경 측 활성화 조건 포함 (Option C).
  //   옛 spec: qty 변경 (allUnchanged 측) 필수 → 받은 돈만 수정 시 disabled.
  //   새 spec: qty 변경 OR per-item 받은 돈 변경 OR receivedTotal 변경 → 활성화.
  const itemQtyChanged = workItems.some(wi =>
    (Number(actualQtyById[wi.id] ?? wi.qty) || 0) !== (Number(wi.qty) || 0)
  );
  const itemReceivedChanged = usesPerItemFlow && allMainItems.some(it => {
    if (it.isCanceled) return false;
    const act = Number(actualQtyById[it.id] ?? it.qty) || 0;
    if (act === 0) return false;
    const v   = parseInt(receivedById[it.id] || "0", 10) || 0;
    const dbV = Number(it.receivedAmount ?? it.subtotal ?? 0);
    return v !== dbV;
  });
  const receivedTotalChanged = !usesPerItemFlow && usesReceivedTotalFlow && (
    (parseInt(receivedTotal || "0", 10) || 0) !== Number(task.receivedTotal ?? 0)
  );
  const anyChanged = itemQtyChanged || itemReceivedChanged || receivedTotalChanged;
  const canSubmit = !!reasonId && anyPositive && anyChanged;

  // 측 catch 측 catch 자동 측 catch (상품별 주문→실제, 취소 K건)
  function buildAutoMemo() {
    const lines = [];
    let cancelCount = 0;
    for (const wi of workItems) {
      const ord = Number(wi.qty) || 0;
      const act = Number(actualQtyById[wi.id] ?? wi.qty) || 0;
      if (act < ord) cancelCount += (ord - act);
      const name = wi.appliance || wi.workType || wi.workItem || "항목";
      if (act !== ord) lines.push(`${name} 주문${ord}→실제${act}`);
    }
    const head = lines.length ? `부분완료 — ${lines.join(", ")}` : "부분완료";
    const cancel = cancelCount > 0 ? `, 취소 ${cancelCount}건` : "";
    const userMemo = memo.trim() ? `\n[기사 메모] ${memo.trim()}` : "";
    return `${head}${cancel}.${userMemo}`;
  }

  function handleConfirm() {
    if (!canSubmit) return;
    // 2026-05-25 — task_item 변경 spec (Round 1 마이그 070 적용 후):
    //   newQty=0 (미수행/전부 취소) → is_canceled=true (qty 원본 보존).
    //                                 070 BEFORE 트리거가 customer_paid_amount·net_amount=0 + metadata 백업,
    //                                 AFTER 트리거가 tasks.product_price 자동 동기.
    //   newQty>0 && newQty<originalQty (부분수량 감소) → qty UPDATE (옛 동작 유지).
    //   newQty>=originalQty 또는 변경 없음 → skip.
    const itemUpdates = workItems.map(wi => ({
      id: wi.id,
      newQty: Number(actualQtyById[wi.id] ?? wi.qty) || 0,
      originalQty: Number(wi.qty) || 0,
    }));
    // 2026-05-31 — Phase C Step 5 — per-item 받은 돈 updates (메인 2개+ 흐름)
    //   비-취소 + 메인 row 측만 send (canceled row 측 trigger SUM 측 자동 제외)
    const itemReceivedUpdates = usesPerItemFlow
      ? allMainItems
          .filter(it => {
            const act = Number(actualQtyById[it.id] ?? it.qty) || 0;
            return !it.isCanceled && act > 0;
          })
          .map(it => ({
            itemId: it.id,
            receivedAmount: parseInt(receivedById[it.id] || "0", 10) || 0,
          }))
      : null;
    onConfirm && onConfirm({
      type: "partial",
      itemUpdates,
      reasonId,
      memo,
      autoMemo: buildAutoMemo(),
      total,
      // Phase B (단일 메인 / 가드 외): single receivedTotal — usesPerItemFlow 측 null.
      receivedTotal: (usesReceivedTotalFlow && !usesPerItemFlow) ? receivedNum : null,
      // Phase C (per-item, 메인 2개+): row 측 받은 돈 array
      itemReceivedUpdates,
      // Phase C: 합계 받은 돈 (UI 디스플레이 + onUpdate 측)
      sumPerItemReceived: usesPerItemFlow ? sumPerItemReceived : null,
      baseAmount,
      earning,
      photos: photos.length,
    });
  }

  return (
    <Container>
      <ScreenHeader title="● 부분 완료" onBack={onBack}/>
      <CustomerCard
        task={task}
        accentColor="#888"
        subText={workItems.length ? `의뢰: ${workItems.length}개 항목` : ""}
      />

      {/* 2026-05-31 — Phase C Step 5 — 메인 2개+ 측 PartialPerItemCards (counter + 받은 돈 통합).
            usesPerItemFlow 측 옛 counter 리스트 hide → 카드 측 통합 처리. */}
      {usesPerItemFlow ? (
        <PartialPerItemCards
          items={allMainItems}
          actualQtyById={actualQtyById}
          onItemQtyChange={setItemQty}
          receivedById={receivedById}
          onReceivedChange={setReceivedForItem}
          onAddToItem={addReceivedToItem}
        />
      ) : null}

      {/* 측 상품별 실 작업 수량 — 단일 메인 / 가드 case 측 옛 counter 리스트 */}
      <div style={{ margin: "0 16px 14px", display: usesPerItemFlow ? "none" : undefined }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
          🔢 작업 항목별 — 수량
        </div>
        {workItems.length === 0 ? (
          <div style={{
            padding: 14, textAlign: "center",
            color: "var(--text-secondary)", fontSize: 13,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)", borderRadius: 12,
          }}>
            상품 정보가 없습니다.
          </div>
        ) : workItems.map(wi => {
          const ord = Number(wi.qty) || 0;
          const act = Number(actualQtyById[wi.id] ?? wi.qty) || 0;
          const cancelled = act === 0;
          const name = wi.appliance || wi.workType || wi.workItem || "항목";
          const orderTypeLabel = wi.orderType || wi.order_type || "";
          const colors = getWorkTypeColors(wi.workType);
          return (
            <div key={wi.id} style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 12px", marginBottom: 6,
              display: "flex", alignItems: "center", gap: 10,
              opacity: cancelled ? 0.7 : 1,
            }}>
              {/* 좌측 — 작업종류 컬러 라벨 + 기종 + 주문 수량 */}
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* 작업종류 라벨 (아이콘 + 이름) + 취소 배지 — v21 일관성 톤 */}
                <div style={{
                  fontSize: 11, fontWeight: 800,
                  color: cancelled ? "#9CA3AF" : colors.main,
                  marginBottom: 3,
                  display: "flex", alignItems: "center", gap: 6,
                  letterSpacing: 0.2,
                }}>
                  <span style={{ fontSize: 13, filter: cancelled ? "grayscale(1)" : "none" }}>{colors.icon}</span>
                  <span>{colors.name}</span>
                  {cancelled && (
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      padding: "1px 6px", borderRadius: 999,
                      background: "#FCEBEB", color: "#A32D2D",
                      whiteSpace: "nowrap",
                    }}>✗ 취소</span>
                  )}
                </div>
                {/* 기종 + (주문유형) — 취소 시 회색 + 취소선 */}
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: cancelled ? "#9CA3AF" : "var(--text-primary)",
                  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                }}>
                  <span style={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    textDecoration: cancelled ? "line-through" : "none",
                  }}>{name}</span>
                  {orderTypeLabel && (
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>
                      ({orderTypeLabel})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginTop: 1 }}>
                  주문 {ord}대
                </div>
              </div>
              {/* 측 catch — 측 catch 측 catch 측 catch */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}>
                <CounterBtn
                  label="−"
                  size={30}
                  disabled={act <= 0}
                  onClick={() => setItemQty(wi.id, Math.max(0, act - 1))}
                />
                <div style={{
                  fontSize: 18, fontWeight: 700, fontFamily: "inherit",
                  color: cancelled ? "var(--text-tertiary)" : "var(--text-primary)",
                  minWidth: 22, textAlign: "center", lineHeight: 1,
                }}>{act}</div>
                <CounterBtn
                  label="+"
                  size={30}
                  disabled={act >= ord}
                  onClick={() => setItemQty(wi.id, Math.min(ord, act + 1))}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ReasonRadioList
        reasons={PARTIAL_REASONS}
        selectedId={reasonId}
        onChange={setReasonId}
        accentColor="#888"
        label="⚠️ 부분 완료 사유 (필수)"
      />

      {/* 금액 요약 분기 (3-way):
            usesPerItemFlow 측 — PartialPerItemCards 측 내부 합계 카드 측 충분 → 별도 summary X
            usesReceivedTotalFlow (단일 메인) 측 — PartialReceivedSummary (Phase B Step 4)
            가드 측 — AmountSummaryCard (옛) */}
      {usesPerItemFlow ? null
        : usesReceivedTotalFlow ? (
          <PartialReceivedSummary
            baseAmount={baseAmount}
            origAmount={origAmount}
            receivedTotal={receivedTotal}
            onReceivedChange={setReceivedTotal}
            accentColor="#D4537E"
          />
        ) : (
          <AmountSummaryCard baseAmount={baseAmount} extraFee={extraFee} accentColor="#888"/>
        )}
      <EarningOnlyCard amount={earning} color="#888" loading={earningLoading}/>

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

function CounterBtn({ label, onClick, disabled, size = 56 }) {
  const fontSize = size <= 32 ? 18 : 28;
  const radius   = size <= 32 ? 8  : 12;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: size, height: size, borderRadius: radius,
      background: disabled ? "var(--bg-tertiary)" : "#C8C8C8",
      border: "none",
      color: disabled ? "var(--text-tertiary)" : "#1A1A1A",
      fontSize, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      opacity: disabled ? 0.5 : 1,
      flexShrink: 0,
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

      {/* 2026-05-21 — 출장비 측 = 견적 측 측 / 출장비 = 측 기사 (Migration 048) */}
      <AmountSummaryCard baseAmount={0} extraFee={fee} accentColor="#FF3B5C"/>
      {/* V14 v6 — 사장님 Q6: 본인 수익만 */}
      <EarningOnlyCard amount={earning} color="#FF1B8D" subText="출장비 (작업 불가)"/>

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
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      paddingBottom: 8,
    }}>
      {children}
    </div>
  );
}
