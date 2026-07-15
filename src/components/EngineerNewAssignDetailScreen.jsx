// V14 정제 — 새 배정 상세
// 흰 카드 + 좌측 4px 핑크 바 / 추가금 영역 제거 / 색 절제

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
// 2026-06-16 — 주소 표시 + 복사 공통 컴포넌트.
import { AddressLine } from "./common/AddressLine.jsx";
import { DropdownPicker, HOURS_24, MINUTES_30 } from "./DropdownPicker.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { WorkItemRow } from "./WorkItemRow.jsx";
import { workDateLabel, workDateColor } from "../utils/dateLabel.js";
// 2026-05-27 — usol_n 품목별 engineer_amount RPC (작업 상세 패턴 동일 — EngineerApp.jsx:3983-4001)
import { supabase } from "../lib/supabase.js";
// 2026-05-29 — 운영자/원청 별도 메모 (현장결제 안내 등) 새 배정 단계에서도 표시
import { useTaskMemos, getMemoTypeLabel, getAuthorRoleEmoji } from "../lib/taskMemosDb.js";
// 2026-05-29 — 결제 방식 라벨 (현장결제/선결제 등 안전 정보 시각화)
import { PAYMENT_METHOD_LABELS } from "../data/paymentMethods.js";
// 2026-07-11 — 홈페이지 접수 기종 미정 팝업 (새 배정 화면에서도 통화 후 기종 입력).
import { ApplianceSelectModal, needsApplianceSelection } from "./ApplianceSelectModal.jsx";

const PhoneSvgWhite = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.4"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const NavSvgWhite = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.4"
       strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
  </svg>
);

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 15, fontWeight: 600,
      color: "var(--text-primary)",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: 14,
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: 10,
  color: "var(--text-primary)",
  fontSize: 15, fontWeight: 600,
  boxSizing: "border-box",
  outline: "none", fontFamily: "inherit",
};

export function EngineerNewAssignDetailScreen({
  task,
  onBack,
  onSave,
  onUnableSchedule,
  onCustomerCancel,
  onAskOps,
}) {
  // 2026-05-27 — 옛 task.callMemo (DB 매핑 없는 죽은 키) → 평탄화된 task.callMemo
  //   (v14NormalizeTask 가 category_data.callMemo 평탄화) 또는 raw category_data.callMemo fallback.
  //   재진입 시 본인이 쓴 메모 그대로 보이게.
  const [memo, setMemo]                 = useState(task?.callMemo || task?.categoryData?.callMemo || "");
  // 2026-07-11 — 사장님 spec: 새 배정 화면에도 기종 선택 팝업.
  const [showApplianceModal, setShowApplianceModal] = useState(false);
  // 2026-07-14 — 사장님 spec: 고객 취소 시 브라우저 confirm 만 뜨고 사유 미기록 → 사유 팝업.
  const [showCancelModal, setShowCancelModal]   = useState(false);
  const [cancelReason, setCancelReason]         = useState(null);
  const [cancelMemo, setCancelMemo]             = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  // 진단 로그 — 사장님 F12 콘솔 검증용. 확정 후 제거.
  useEffect(() => {
    const wi = Array.isArray(task?.workItems) ? task.workItems : [];
    console.log("[NewAssignDetail applianceCheck]", {
      taskId: task?.id,
      workItems_count: wi.length,
      first_workType:  wi[0]?.workType,
      first_appliance: wi[0]?.appliance,
      root_workType:   task?.workType,
      root_appliance:  task?.appliance,
      applianceUndecided: task?.applianceUndecided,
      needs: needsApplianceSelection(task),
    });
  }, [task]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showCustom, setShowCustom]     = useState(false);
  const [customDate, setCustomDate]     = useState("");
  const [customHour, setCustomHour]     = useState("14");
  const [customMin, setCustomMin]       = useState("00");
  // 2026-05-27 — usol_n 품목별 engineer_amount (Migration 065 RPC).
  //   작업 상세 화면 패턴 동일 (EngineerApp.jsx:3983-4001).
  //   RPC 실패 시 빈 객체 → 아래 렌더에서 분배식 fallback (engineer_amount × subtotal/SUM).
  const [itemEngineerAmounts, setItemEngineerAmounts] = useState({});
  // task_memos realtime — 운영자가 새 배정 알림 후 추가한 메모도 자동 갱신.
  const { memos } = useTaskMemos(task?.id);
  useEffect(() => {
    if (!task?.id) return;
    if (task.principalCode !== "usol_n") return;  // usol_n만 RPC 의미 있음
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("compute_engineer_amount_per_item", { p_task_id: task.id });
        if (cancelled || error || !Array.isArray(data)) return;
        const map = {};
        for (const row of data) {
          if (row?.task_item_id != null) map[row.task_item_id] = Number(row.engineer_amount) || 0;
        }
        setItemEngineerAmounts(map);
      } catch { /* RPC 실패 — 분배 fallback */ }
    })();
    return () => { cancelled = true; };
  }, [task?.id, task?.principalCode]);

  // 사장님 운영 패턴 (당일 +15분~2h) — 30분 단위 5개 빠른 슬롯, 현재시간 +15분 반올림 기준
  const slots = useMemo(() => {
    const now = new Date();
    const minPlus15 = new Date(now.getTime() + 15 * 60 * 1000);
    const rounded = Math.ceil(minPlus15.getMinutes() / 30) * 30;
    const firstSlot = new Date(minPlus15);
    firstSlot.setMinutes(rounded, 0, 0);
    return Array.from({ length: 5 }, (_, i) => {
      const t = new Date(firstSlot.getTime() + i * 30 * 60 * 1000);
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      return {
        hhmm: `${hh}:${mm}`,
        diffMin: Math.max(0, Math.round((t.getTime() - now.getTime()) / 60000)),
      };
    });
  }, []);

  if (!task) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        작업 정보 없음
      </div>
    );
  }

  const colors = getWorkTypeColors(task.workType);

  function makeCall() {
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }

  function openMap() {
    const address = encodeURIComponent(task.fullAddress || task.address || "");
    if (!address) return;
    window.open(`https://map.kakao.com/?q=${address}`, "_blank");
  }

  function handleSave() {
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    let scheduledDate, scheduledTime;
    if (showCustom && customDate) {
      scheduledDate = customDate;
      scheduledTime = `${customHour}:${customMin}`;
    } else if (selectedSlot) {
      scheduledDate = todayYmd;
      scheduledTime = selectedSlot;
    } else {
      return;
    }
    // endTime = scheduledTime + 1h 자동 fallback (캘린더/DB NOT NULL 안전망)
    const [sh, sm] = scheduledTime.split(":").map(Number);
    const endMins = sh * 60 + sm + 60;
    const eh = Math.floor(endMins / 60) % 24;
    const em = endMins % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    onSave && onSave({ memo, scheduledDate, scheduledTime, endTime });
  }

  // 확정 버튼에 박을 시간
  const confirmTime = showCustom ? `${customHour}:${customMin}` : selectedSlot;
  const canConfirm = !!confirmTime && (!showCustom || !!customDate);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      paddingBottom: 30,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
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
        <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600 }}>
          새 배정
        </div>
        <div style={{ width: 28 }}/>
      </div>

      {/* 1. 정보 카드 (흰 카드 + 좌측 4px 핑크 바) */}
      <div style={{ padding: 16 }}>
        <div style={{
          position: "relative",
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "16px 16px 16px 20px",
          overflow: "hidden",
          marginBottom: 12,
        }}>
          {/* 좌측 4px 바 — 작업 종류 색 */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: 4,
            background: colors.main,
          }}/>

          {/* V14 v7 — 날짜 라인 */}
          {task.scheduledDate && (
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: workDateColor(task.scheduledDate),
              marginBottom: 8,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>📅</span>
              <span>{workDateLabel(task.scheduledDate)}</span>
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600,
            color: colors.main,
            marginBottom: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: colors.main,
              display: "inline-block",
            }}/>
            새 배정
            {task.requestedAgo && (
              <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>
                · {task.requestedAgo}
              </span>
            )}
          </div>

          {/* 2026-05-27 — 작업 항목 다중 렌더 (task.workItems 배열 전부).
              옛: head 한 줄(task.workType 등) — 추가선택 품목 누락 사고 (신정원·김상협).
              신: task.workItems map → 품목 전부 표시. 작업 상세(EngineerTaskDetailScreen) 패턴.
              · usol_n: 각 item의 engineer_amount (RPC 1순위 / 분배식 fallback) + "내 정산금" 라벨
              · 다른 6원청: 각 item의 subtotal (상품가) + 라벨 없음 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {(() => {
              const isUsolN = task.principalCode === "usol_n";
              const workItems = Array.isArray(task.workItems) && task.workItems.length > 0
                ? task.workItems
                : [{ workType: task.workType, appliance: task.appliance, qty: task.qty,
                     subtotal: task.estimateTotal }];
              // usol_n 분배 fallback 계수 (RPC 실패 시)
              const totalEng = Number(task.engineer_amount || 0);
              const sumSub = workItems.reduce((s, w) => {
                const sub = Number(w.subtotal ?? (w.unit_price ?? w.unitPrice ?? 0) * (w.qty || 1));
                return s + sub;
              }, 0);
              const distRatio = (sumSub > 0 && totalEng > 0) ? (totalEng / sumSub) : 0.6;
              return workItems.map((wi, idx) => {
                const subtotal = Number(wi.subtotal ?? (wi.unit_price ?? wi.unitPrice ?? 0) * (wi.qty || 1));
                let price;
                if (isUsolN) {
                  const itemId = wi.id || wi.task_item_id;
                  const rpcAmount = (itemId != null) ? itemEngineerAmounts[itemId] : undefined;
                  price = (rpcAmount != null) ? rpcAmount : Math.floor(subtotal * distRatio);
                } else {
                  // 2026-07-15 — 사장님 spec: 이 화면 금액은 "고객 견적"이어야 하는데
                  //   item subtotal 이 기사 단가로 들어오는 원청이 있어 기사 수입처럼 보였음.
                  //   → per-item 가격 숨기고 아래 "고객 견적" 한 줄(estimateTotal)로 통일.
                  price = null;
                }
                return (
                  <WorkItemRow
                    key={wi.id || idx}
                    workType={wi.work_types?.name || wi.workType || task.workType}
                    appliance={wi.appliance_types?.name || wi.appliance || ""}
                    qty={wi.qty || 1}
                    price={price}
                    priceLabel={isUsolN ? "내 정산금" : null}
                    client={task.client}
                    dividerTop={idx > 0}
                    isCanceled={!!(wi.isCanceled ?? wi.is_canceled)}
                  />
                );
              });
            })()}
          </div>

          {/* 2026-07-15 — 고객 견적 (상담용, 사장님 spec). usol_n 제외 (내 정산금 표시 유지). */}
          {task.principalCode !== "usol_n" && Number(task.estimateTotal || 0) > 0 && (
            <div style={{
              margin: "0 0 12px",
              padding: "9px 12px",
              borderRadius: 10,
              background: "rgba(255,27,141,0.06)",
              border: "1px solid rgba(255,27,141,0.25)",
              display: "flex", alignItems: "center",
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#C2185B" }}>💬 고객 견적</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "#C2185B" }}>
                ₩{Number(task.estimateTotal).toLocaleString("ko-KR")}
              </span>
            </div>
          )}

          <div style={{
            fontSize: 26, fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            marginBottom: 6,
          }}>
            {task.customer || "—"}님
          </div>

          <div style={{
            fontSize: 14, fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: 4,
          }}>
            📞 {task.phone || "—"}
          </div>

          {/* 2026-06-16 — 주소 + 복사 (공통 AddressLine plain). */}
          <AddressLine
            task={task}
            variant="plain"
            iconColor="var(--text-secondary)"
            baseStyle={{
              fontSize: 14, fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          />

          {/* 2026-05-29 — 결제 방식 라벨 (선택값 있을 때만 / NULL 숨김) */}
          {task.paymentMethod && (
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: "var(--text-secondary)",
              marginTop: 4,
            }}>
              💳 {PAYMENT_METHOD_LABELS[task.paymentMethod] || task.paymentMethod}
            </div>
          )}
        </div>

        {/* 통화 + 길찾기 */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          <button onClick={makeCall} style={{
            padding: 13,
            background: "#34C759",
            border: "none", borderRadius: 10,
            color: "#fff",
            fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <PhoneSvgWhite/> 통화
          </button>
          <button onClick={openMap} style={{
            padding: 13,
            background: colors.main,
            border: "none", borderRadius: 10,
            color: "#fff",
            fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            <NavSvgWhite/> 길찾기
          </button>
        </div>
      </div>

      {/* 2. 노랑 요청사항 박스 — task.requestNote (DB request_note 매핑, v14NormalizeTask 평탄화).
           2026-05-29 — 옛 task.customerRequest 죽은 키 (어디서도 채워지지 않음) → requestNote 정정.
           운영자 form.memo 입력이 즉시 새 배정 화면에 표시되게. */}
      {(task.requestNote || task.requestedDate) && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            position: "relative",
            background: "var(--request-bg)",
            borderRadius: 12,
            padding: "14px 14px 14px 18px",
            overflow: "hidden",
          }}>
            {/* 좌측 4px 노란 바 */}
            <div style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: 4,
              background: "#FFB800",
            }}/>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: "var(--request-text)",
              marginBottom: 6,
            }}>
              ⚠️ 고객 요청사항
            </div>
            {task.requestNote && (
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.5,
                marginBottom: task.requestedDate ? 6 : 0,
              }}>
                {task.requestNote}
              </div>
            )}
            {task.requestedDate && (
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: "var(--request-sub)",
              }}>
                🕐 고객 희망: {task.requestedDate} {task.requestedTime || ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2026-07-11 — 사장님 spec: 새 배정 화면 [기종 선택] 배너.
            요청사항 아래 · 도착시간(=일정 확정) 위. needsApplianceSelection 판정. */}
      {needsApplianceSelection(task) && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            padding: "13px 15px",
            background: "#FFF7ED",
            border: "1px solid #F59E0B",
            borderLeft: "4px solid #F59E0B",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#9A3412" }}>⚠️ 기종 미정</div>
              <div style={{ fontSize: 12, color: "#78350F", fontWeight: 600, marginTop: 3 }}>
                고객과 통화 후 기종을 선택하세요. 금액이 자동 반영됩니다.
              </div>
            </div>
            <button
              onClick={() => setShowApplianceModal(true)}
              style={{
                padding: "10px 18px",
                background: "#F59E0B", border: "none",
                borderRadius: 10, color: "#fff",
                fontSize: 14, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0,
              }}>기종 선택</button>
          </div>
        </div>
      )}
      {showApplianceModal && (
        <ApplianceSelectModal
          task={task}
          onClose={() => setShowApplianceModal(false)}
          onSaved={() => {
            setShowApplianceModal(false);
            alert("기종 저장 완료. 새 배정 목록으로 돌아갑니다. 다시 열면 반영됩니다.");
            onBack && onBack();
          }}
        />
      )}

      {/* 2026-05-29 — 운영자/원청 메모 카드 (task_memos) — 작업 정보 아래, 협의 입력 위.
          현장결제 안내 등 수락 전 알아야 할 안전 정보 전부 노출 (slice 없음). */}
      {memos.length > 0 && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: 10,
            }}>
              💬 메모 ({memos.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {memos.map((m) => (
                <div key={m.id} style={{
                  background: "var(--bg-secondary)",
                  borderRadius: 6, padding: "8px 10px",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))",
                    marginBottom: 4, fontWeight: 600,
                  }}>
                    <span>{getMemoTypeLabel(m.memo_type)}</span>
                    <span>·</span>
                    <span>{getAuthorRoleEmoji(m.author_role)} {m.author_name || "—"}</span>
                    <span style={{ marginLeft: "auto" }}>
                      {m.created_at ? String(m.created_at).slice(0, 16).replace("T", " ") : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500 }}>
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. 입력 카드 */}
      <div style={{ padding: "0 16px 14px" }}>
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "18px 16px",
        }}>
          {/* 1. 도착 예정 시간 (오늘) — 30분 단위 5개 빠른 슬롯 */}
          <SectionLabel>🕐 도착 예정 시간 (오늘)</SectionLabel>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6,
            marginBottom: 12,
          }}>
            {slots.map(({ hhmm, diffMin }) => {
              const active = !showCustom && selectedSlot === hhmm;
              return (
                <button
                  key={hhmm}
                  onClick={() => { setShowCustom(false); setSelectedSlot(hhmm); }}
                  style={{
                    padding: "10px 0",
                    background: active ? "rgba(255,27,141,0.04)" : "var(--card-bg)",
                    border: active ? "2px solid #FF1B8D" : "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text-primary)",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{hhmm}</span>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
                    +{diffMin}분 후
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. 다른 시간/날짜 직접 선택 — 부가 흐름 (접힘 → 펼침) */}
          <button
            onClick={() => {
              const next = !showCustom;
              setShowCustom(next);
              if (next) setSelectedSlot(null);
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: showCustom ? "rgba(255,27,141,0.04)" : "var(--card-bg)",
              border: showCustom ? "2px solid #FF1B8D" : "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-primary)",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              textAlign: "left",
              marginBottom: showCustom ? 8 : 14,
            }}
          >
            📅 다른 시간/날짜 직접 선택
          </button>

          {showCustom && (() => {
            // 2026-07-15 — 사장님 spec: 달력/드롭다운 대신 칩 — 날짜 가로줄 + 시 가로줄 + 분 토글.
            const _pad = (n) => String(n).padStart(2, "0");
            const _ymd = (d) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
            const _now = new Date();
            const _todayYmd = _ymd(_now);
            const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
            const dayChips = Array.from({ length: 6 }, (_, i) => {
              const d = new Date(_now);
              d.setDate(d.getDate() + i);
              const label = i === 0 ? "오늘" : i === 1 ? "내일" : i === 2 ? "모레" : DAY_NAMES[d.getDay()];
              return { ymd: _ymd(d), label, sub: `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`, dow: d.getDay() };
            });
            const inChips = dayChips.some(c => c.ymd === customDate);
            const isToday = customDate === _todayYmd;
            const chipBase = {
              flexShrink: 0, textAlign: "center", borderRadius: 10,
              background: "var(--card-bg)", border: "1.5px solid var(--border)",
              cursor: "pointer", fontFamily: "inherit", color: "var(--text-primary)",
            };
            const onStyle = { borderColor: "#FF1B8D", background: "rgba(255,27,141,0.06)", color: "#C2185B" };
            return (
              <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* 날짜 칩 */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                  {dayChips.map(c => (
                    <button key={c.ymd} onClick={() => setCustomDate(c.ymd)}
                      style={{ ...chipBase, width: 62, padding: "7px 0", fontSize: 12, fontWeight: 700,
                               ...(customDate === c.ymd ? onStyle : {}),
                               color: customDate === c.ymd ? "#C2185B" : (c.dow === 0 ? "#E53935" : c.dow === 6 ? "#1E88E5" : "var(--text-primary)") }}>
                      {c.label}
                      <span style={{ display: "block", fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginTop: 1 }}>{c.sub}</span>
                    </button>
                  ))}
                  <label style={{ ...chipBase, width: 62, padding: "7px 0", fontSize: 12, fontWeight: 700,
                                  ...(customDate && !inChips ? onStyle : {}), position: "relative", overflow: "hidden" }}>
                    달력
                    <span style={{ display: "block", fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginTop: 1 }}>
                      {customDate && !inChips ? customDate.slice(5).replace("-", "/") : "그 이후"}
                    </span>
                    <input type="date" value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}/>
                  </label>
                </div>
                {/* 시 가로 칩 */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                  {Array.from({ length: 15 }, (_, i) => 7 + i).map(h => {
                    const hh = _pad(h);
                    const past = isToday && h <= _now.getHours();
                    const on = customHour === hh;
                    return (
                      <button key={h} onClick={() => setCustomHour(hh)}
                        style={{ ...chipBase, width: 48, padding: "9px 0", fontSize: 13, fontWeight: 700,
                                 opacity: past && !on ? 0.35 : 1,
                                 ...(on ? { borderColor: "#FF1B8D", background: "#FF1B8D", color: "#fff" } : {}) }}>
                        {h}시
                      </button>
                    );
                  })}
                </div>
                {/* 분 토글 */}
                <div style={{ display: "flex", gap: 6 }}>
                  {["00", "30"].map(m => (
                    <button key={m} onClick={() => setCustomMin(m)}
                      style={{ ...chipBase, flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 700,
                               ...(customMin === m ? { borderColor: "#FF1B8D", background: "#FF1B8D", color: "#fff" } : {}) }}>
                      {m}분
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 3. 협의 메모 */}
          <SectionLabel>📝 협의 메모 (선택)</SectionLabel>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
            placeholder="고객과 협의한 내용 / 특이사항"
            style={{ ...inputStyle, height: 70, fontSize: 12, resize: "vertical" }}/>
        </div>
      </div>

      {/* 4. 액션 3개 */}
      <div style={{ padding: "0 16px" }}>
        <button onClick={handleSave} disabled={!canConfirm} style={{
          width: "100%", padding: 14,
          background: canConfirm ? "#FF1B8D" : "transparent",
          border: canConfirm ? "none" : "1px solid var(--border)",
          borderRadius: 12,
          color: canConfirm ? "#fff" : "var(--text-secondary)",
          fontSize: 14, fontWeight: 600,
          cursor: canConfirm ? "pointer" : "not-allowed", fontFamily: "inherit",
          marginBottom: 8,
        }}>
          {canConfirm ? `✓ 일정 확정 → ${confirmTime} 도착 예정` : "도착 시간 선택"}
        </button>

        {/* 2026-07-15 — 사장님 spec: [일정 불가] 버튼 제거 (재배정은 운영자 통해서만). */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <button onClick={() => { setCancelReason(null); setCancelMemo(""); setShowCancelModal(true); }} style={{
            padding: 14,
            background: "var(--card-bg)",
            border: "1.5px solid #FF3B5C",
            borderRadius: 12,
            color: "var(--cancel-text)",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            ✕ 고객 취소
          </button>
        </div>
      </div>

      {/* 5. 운영팀 문의 — V14 v8 카카오 공식 브랜딩 */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onAskOps} style={{
            background: "#34C759",
            color: "#fff",
            border: "none",
            padding: 14,
            borderRadius: 12,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            📞 운영팀 전화
          </button>
          <button onClick={onAskOps} style={{
            background: "#FEE500",
            color: "#391B1B",
            border: "none",
            padding: 14,
            borderRadius: 12,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#391B1B" aria-hidden="true">
              <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.74 5.16 4.36 6.55-.18.61-.65 2.18-.74 2.51-.12.4.15.4.31.29.13-.09 2.04-1.39 2.85-1.95.4.06.81.1 1.22.1 5.52 0 10-3.48 10-7.79S17.52 3 12 3z"/>
            </svg>
            카톡 문의
          </button>
        </div>
      </div>

      {/* 2026-07-14 — 고객 취소 사유 팝업 (사장님 spec).
            사유 필수 선택 + 메모(선택) → onCustomerCancel(사유 문자열) 로 전달. */}
      {showCancelModal && (
        <div
          onClick={() => !cancelSubmitting && setShowCancelModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480,
              background: "var(--bg-primary)",
              borderRadius: "16px 16px 0 0",
              padding: "20px 16px 24px",
              fontFamily: "inherit",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
              ✕ 고객 취소 처리
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
              취소 사유를 선택해주세요. 운영팀 기록에 남습니다.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {["고객 취소 요청", "고객 연락 두절", "중복 접수", "기타"].map(r => (
                <button
                  key={r}
                  onClick={() => setCancelReason(r)}
                  style={{
                    padding: 12,
                    background: cancelReason === r ? "rgba(255,61,90,0.10)" : "var(--bg-secondary)",
                    border: cancelReason === r ? "1.5px solid #FF3D5A" : "1px solid var(--border)",
                    borderRadius: 8,
                    color: cancelReason === r ? "#FF3D5A" : "var(--text-primary)",
                    fontSize: 13, fontWeight: 600, textAlign: "left",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={cancelMemo}
              onChange={(e) => setCancelMemo(e.target.value)}
              placeholder="상세 내용 (선택) — 예: 다른 업체에서 이미 처리"
              style={{
                width: "100%", boxSizing: "border-box",
                height: 64, padding: 10,
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12, fontFamily: "inherit", resize: "vertical",
                marginBottom: 14,
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelSubmitting}
                style={{
                  padding: 14,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--text-secondary)",
                  fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                닫기
              </button>
              <button
                onClick={async () => {
                  if (!cancelReason || cancelSubmitting) return;
                  setCancelSubmitting(true);
                  const reasonText = cancelMemo.trim()
                    ? `${cancelReason} — ${cancelMemo.trim()}`
                    : cancelReason;
                  try {
                    await onCustomerCancel?.(reasonText);
                  } finally {
                    setCancelSubmitting(false);
                    setShowCancelModal(false);
                  }
                }}
                disabled={!cancelReason || cancelSubmitting}
                style={{
                  padding: 14,
                  background: (!cancelReason || cancelSubmitting) ? "var(--bg-tertiary)" : "#FF3B5C",
                  border: "none",
                  borderRadius: 12,
                  color: (!cancelReason || cancelSubmitting) ? "var(--text-tertiary)" : "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: (!cancelReason || cancelSubmitting) ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {cancelSubmitting ? "처리 중..." : "취소 확정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EngineerNewAssignDetailScreen;
