// V13-FINAL — 기사 PWA 작업 상세 (3 상태 + 부분 취소 + 일정 변경 + 출장비만)
// V14 — 사진 분류 X / 완료 분기 3가지 (완료 / 부분 / 출장비만)
// 진입: 오늘 화면 / 새 배정 리스트 / 다음 일정
// 상태: "미배정" / "배정" / "확정" / "진행중" / "완료" / "visit_only" / "취소"
// 한 화면 흐름 (별도 완료보고 화면 X)

import { useRef, useState, useEffect } from "react";
import { ArrowLeft, Camera, X, Copy } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import { uploadPhoto, listPhotosByTask } from "../lib/photosDb.js";
import { changePriceAdapter as apiChangePrice, markVisitOnlyAdapter, setReceivedTotalAdapter as apiSetReceivedTotal } from "../data/tasksDb.js";
import { isRefrigerant as isRefrigerantWorkType } from "../utils/workTypeKind.js";
import { supabase } from "../lib/supabase.js";
import {
  TaskCompleteScreen as CompletionCompleteScreen,
  TaskPartialScreen,
  TaskVisitOnlyScreen,
} from "./EngineerTaskCompletionScreens.jsx";
import RefrigerantConsentScreen from "./RefrigerantConsentScreen.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { workDateLabel, workDateColor, formatTimeOnly, calcTotalDuration } from "../utils/dateLabel.js";
import { useIsDark } from "../hooks/useIsDark.js";
import { WorkItemRow } from "./WorkItemRow.jsx";
// Round 3 — Migration 076 RPC (anon 키 + p_actor 패턴, 옛 updateTaskAdapter 경로 우회)
import { rescheduleEngineerTask } from "../lib/engineerTaskRpc.js";
// 2026-05-27 Phase 2 — Supabase task_memos (운영자↔기사 양방향)
import { useTaskMemos, getMemoTypeLabel, getAuthorRoleEmoji } from "../lib/taskMemosDb.js";
// 2026-05-29 — 결제 방식 라벨 (현장결제/선결제 등 안전 정보 시각화)
import { PAYMENT_METHOD_LABELS } from "../data/paymentMethods.js";

// ──────────────── helpers ────────────────
function getCurrentTime() {
  // 2026-05-15 fix — DB 측 timestamptz 박힘 → ISO 박는 spec
  // UI 측 박는 거 formatTimeOnly 측 ISO → "HH:MM" 변환 박힘 (robust)
  return new Date().toISOString();
}

function calcDepartureTime(task) {
  const sched = task.scheduledTime || task.time;
  const travel = task.travelTime;
  if (!sched || !travel) return "—";
  const [sh, sm] = String(sched).split(":").map(n => parseInt(n, 10) || 0);
  const tMatch = String(travel).match(/(\d+)/);
  const tMin = tMatch ? parseInt(tMatch[1], 10) : 0;
  let totalMin = (sh * 60 + sm) - tMin - 5;
  if (totalMin < 0) totalMin += 24 * 60;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTimeUntilStart(task) {
  if (!task.scheduledTime) return "일정 미정";
  return `예정 시각 ${task.scheduledTime}`;
}

function makeCall(phone) {
  if (phone) window.location.href = `tel:${phone}`;
}

function sendSms(phone) {
  if (phone) window.location.href = `sms:${phone}`;
}

// 2026-05-26 — 길찾기용 주소 합성.
//   DB tasks.address 컬럼이 풀 주소로 저장됨(시·도부터 동·호수까지).
//   풀 주소가 있으면 그대로 사용 → 네이버/T맵/카카오 검색 정확.
//   옛 시드(address="강남구 청담동" + fullAddress="청담로 200,...") 호환을 위해 fallback만 유지.
function buildFullAddress(task) {
  if (task.address && String(task.address).trim()) return String(task.address).trim();
  const region = task.region || "";
  const detail = task.fullAddress || "";
  if (!region && !detail) return "";
  if (!region) return detail;
  if (!detail) return region;
  const cityPrefix = region.includes("시") || region.includes("도") ? "" : "서울 ";
  return `${cityPrefix}${region} ${detail}`.trim();
}

function openMap(task) {
  const addrRaw = buildFullAddress(task);
  if (!addrRaw) { alert("주소 없음"); return; }
  const addr = encodeURIComponent(addrRaw);
  // V14 v6 — 네이버 지도 앱 시도 → 1.5초 후 웹 fallback
  const appUrl = `nmap://search?query=${addr}&appname=ollit`;
  const webUrl = `https://map.naver.com/v5/search/${addr}`;
  const start = Date.now();
  window.location.href = appUrl;
  setTimeout(() => {
    if (Date.now() - start < 2000 && document.visibilityState === "visible") {
      window.open(webUrl, "_blank");
    }
  }, 1500);
}

function openTmap(task) {
  const addrRaw = buildFullAddress(task);
  if (!addrRaw) { alert("주소 없음"); return; }
  const addr = encodeURIComponent(addrRaw);
  // 2026-05-20 — T맵 search 스킴 정정 (옛 route 스킴 측 좌표 필요 spec → 빈 검색 catch)
  //   search 측 주소 텍스트 자동 입력 spec 동작
  const appUrl = `tmap://search?name=${addr}`;
  const webUrl = `https://tmap.life/?q=${addr}`;
  const start = Date.now();
  window.location.href = appUrl;
  setTimeout(() => {
    if (Date.now() - start < 2000 && document.visibilityState === "visible") {
      window.open(webUrl, "_blank");
    }
  }, 1500);
}

// 2026-05-20 — 카카오맵 신규 (앱 deeplink + 웹 fallback)
function openKakaoMap(task) {
  const addrRaw = buildFullAddress(task);
  if (!addrRaw) { alert("주소 없음"); return; }
  const addr = encodeURIComponent(addrRaw);
  const appUrl = `kakaomap://search?q=${addr}`;
  const webUrl = `https://map.kakao.com/?q=${addr}`;
  const start = Date.now();
  window.location.href = appUrl;
  setTimeout(() => {
    if (Date.now() - start < 2000 && document.visibilityState === "visible") {
      window.open(webUrl, "_blank");
    }
  }, 1500);
}

// 2026-05-20 — 주소 복사 (clipboard + 토스트 + 햅틱)
async function copyAddress(task, onToast) {
  const addr = buildFullAddress(task);
  if (!addr) {
    if (onToast) onToast("주소 없음");
    return;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(addr);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = addr;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (navigator?.vibrate) navigator.vibrate(30);
    if (onToast) onToast("주소 복사됨");
  } catch (err) {
    console.error("[copyAddress] failed:", err);
    if (onToast) onToast("복사 실패");
  }
}

// 2026-05-20 — 주소 + 복사 아이콘 inline 컴포넌트 (재사용)
//   주소 표시 영역 측 두 곳 (StatusBlockReady / WorkMainCard) 측 공통 spec
function AddressLine({ task, baseStyle, iconColor = "var(--label-main)" }) {
  const [toast, setToast] = useState(null);
  const addr = task.fullAddress || task.address || "—";
  const hasAddr = addr && addr !== "—";

  function handleCopy(e) {
    e.stopPropagation();
    copyAddress(task, (msg) => {
      setToast(msg);
      setTimeout(() => setToast(null), 1500);
    });
  }

  return (
    <div style={{ position: "relative", ...baseStyle, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ flex: 1, minWidth: 0 }}>📍 {addr}</span>
      {hasAddr && (
        <button
          onClick={handleCopy}
          aria-label="주소 복사"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, padding: 0,
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: 6, color: iconColor,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <Copy size={14}/>
        </button>
      )}
      {toast && (
        <span style={{
          position: "absolute", right: 0, top: "100%", marginTop: 4,
          background: "rgba(0,0,0,0.85)", color: "#fff",
          fontSize: 11, fontWeight: 600,
          padding: "4px 10px", borderRadius: 6,
          whiteSpace: "nowrap", zIndex: 10,
        }}>
          {toast}
        </span>
      )}
    </div>
  );
}

// 작업 항목 정규화 (INITIAL_TASKS는 단일 workType/appliance만 — items 배열로 변환)
// V14 v7 — 사장님 catch: name = appliance(기종) 박음 (workType X)
//
// 2026-05-24 버그2 정정 — item별 '기사 몫' 표시
//   1순위: itemEngineerAmounts (Migration 065 RPC 결과 — task_item.id → engineer_amount)
//          compute_payment v14와 동일 로직 — 측 6 원청 + usol_n 정확.
//   2순위 (RPC 실패 등): 분배식 — engineer_amount × (subtotal / SUM(subtotal))
//          합계는 일치 / item별 분포는 정확도 ↓
//   3순위 (옛 fallback): subtotal × 0.6
function getTaskItems(task, itemEngineerAmounts = {}) {
  if (Array.isArray(task.items) && task.items.length > 0) return task.items;
  const engineerAmount = Number(task.engineer_amount || 0);
  if (Array.isArray(task.workItems) && task.workItems.length > 0) {
    // 분배식 fallback 측 catch SUM(subtotal) 계산
    const sumSubtotal = task.workItems.reduce((s, w) => {
      const sub = Number(w.subtotal || w.unitPrice || w.unit_price || 0) * (w.subtotal ? 1 : (w.qty || 1));
      return s + sub;
    }, 0);
    const distRatio = (sumSubtotal > 0 && engineerAmount > 0)
      ? (engineerAmount / sumSubtotal)
      : 0.6;
    return task.workItems.map((wi, i) => {
      const isCanceled = !!(wi.isCanceled ?? wi.is_canceled);
      const subtotal = Number(wi.subtotal || wi.unitPrice || wi.unit_price || 0) * (wi.subtotal ? 1 : (wi.qty || 1));
      // 1순위 — RPC 결과 (task_item.id 매칭)
      const itemId = wi.id || wi.task_item_id;
      const rpcAmount = (itemEngineerAmounts && itemId != null) ? itemEngineerAmounts[itemId] : undefined;
      const engPrice = isCanceled
        ? 0
        : (rpcAmount != null
            ? rpcAmount
            : Math.floor(subtotal * distRatio));
      return {
        id: `${task.id}-${i}`,
        name: wi.appliance || wi.workType || "",
        qty: wi.qty || 1,
        price: engPrice,
        serviceType: { workType: wi.workType || task.workType },
        orderType: wi.order_type || wi.orderType,
        // 2026-05-25 Round 1 (c) — 부분취소 플래그 (카드 표시 분기용)
        isCanceled,
        canceledReason: wi.canceledReason || wi.canceled_reason || null,
      };
    });
  }
  if (!task.workType) return [];
  return [{
    id: `${task.id}-1`,
    name: task.appliance || task.workType,
    qty: task.qty || 1,
    price: engineerAmount,
    serviceType: task,
  }];
}

// ──────────────── 메인 컴포넌트 ────────────────
// 2026-05-27 — props user, onMemoAdd 추가 (작업 메모 카드 + 추가 버튼)
export function EngineerTaskDetailScreen({ task, itemEngineerAmounts = {}, onBack, onUpdate, onRequestReassign, user, onMemoAdd }) {
  // V14 — 사진 = {url, step} array (작업 전/후 명시적 박음 / 최소 2장 합산)
  const initialPhotos = (() => {
    if (Array.isArray(task.photos)) return task.photos.map(p => {
      if (typeof p === "string") return { url: p, step: "시작" };
      return { url: p?.url || "✓", step: p?.step || "시작" };
    });
    const old = [];
    if (task.photoBefore || task.beforePhoto) old.push({ url: "✓", step: "시작" });
    if (task.photoAfter  || task.afterPhoto)  old.push({ url: "✓", step: "완료" });
    return old;
  })();
  const [photos, setPhotos] = useState(initialPhotos);
  const [extraFee, setExtraFee] = useState(task.extraFee ? String(task.extraFee) : "");
  // 2026-05-30 — Phase B Step 3 — 신규 흐름 (received_total 입력) state.
  //   분기: usesReceivedTotalFlow = principalCode != 'usol_n' && paymentMethod != 'prepaid'.
  //   가드 케이스 (usol_n / prepaid) 는 옛 흐름 (extraFee 직접 입력) 그대로 유지.
  const [receivedTotal, setReceivedTotal] = useState(
    task.receivedTotal != null ? String(task.receivedTotal) : ""
  );
  const [workMemo, setWorkMemo] = useState(task.workMemo || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [visitOnlyOpen, setVisitOnlyOpen] = useState(false);
  const [subScreen, setSubScreen] = useState(null); // null / "cancel" / "reschedule"
  // 2026-05-25 — '일정 변경 · 취소' 카드 접힘/펼침. 기본 접힘 (기사 실수 방지 spec).
  const [actionsOpen, setActionsOpen] = useState(false);
  const [saving, setSaving] = useState(false); // 2026-05-17 — 완료 분기 진입 직전 extraFee 사전 저장 표시
  const beforeFileRef = useRef(null);
  const afterFileRef  = useRef(null);
  const PHOTO_MIN = 2;

  // 2026-05-30 — Phase B Step 3 — 결제 흐름 분기.
  //   가드 케이스 (usol_n OR payment_method='prepaid') → 옛 흐름 (extra_fee 직접 입력).
  //   그 외 → 신규 흐름 (received_total 입력, DB BEFORE 트리거가 extra_fee 자동 sync).
  const usesReceivedTotalFlow =
    task.principalCode !== 'usol_n' && task.paymentMethod !== 'prepaid';

  // 정규화된 파싱 값 (네비게이션 spread 측 측 X 측 재사용)
  const parsedExtra    = parseInt(extraFee || "0", 10);
  const parsedReceived = parseInt(receivedTotal || "0", 10);
  // 신규 흐름의 자동 계산 추가금 (DB 트리거 공식과 동일: GREATEST(received - product, 0))
  const derivedExtra   = Math.max(parsedReceived - (task.estimateTotal || 0), 0);

  // 2026-05-17 시나리오 B — 진행중 화면에서 입력란에 타이핑한 값은 로컬 state만 갱신됨.
  // 완료 분기 화면(완료/부분/출장비) 진입 직전에 DB에 먼저 저장해야
  // 다음 화면 mount 시 compute_payment가 정확한 extra_fee로 재계산함.
  // changePriceAdapter / setReceivedTotalAdapter 측 모두 내부에서 compute_payment RPC 호출.
  async function persistExtraFeeAndNavigate(target) {
    if (saving) return; // 더블 클릭 방지
    const currentDb = Number(task.extraFee || 0);
    if (parsedExtra !== currentDb) {
      setSaving(true);
      try {
        const res = await apiChangePrice(task.id, undefined, parsedExtra, undefined);
        if (!res || res.ok === false) {
          console.warn('[EngineerTaskDetailScreen] extraFee 사전 저장 실패:', res?.error);
        }
      } catch (e) {
        console.warn('[EngineerTaskDetailScreen] extraFee 사전 저장 예외:', e?.message);
      } finally {
        setSaving(false);
      }
    }
    setSubScreen(target);
  }

  // 2026-05-30 — Phase B Step 3 — 신규 흐름 persist.
  //   received_total 만 write → BEFORE 트리거가 extra_fee 자동 sync,
  //   AFTER compute_payment_trg 가 정산 재계산 (Migration 083 컬럼 확장).
  async function persistReceivedTotalAndNavigate(target) {
    if (saving) return;
    const currentDb = Number(task.receivedTotal ?? 0);
    if (parsedReceived !== currentDb) {
      setSaving(true);
      try {
        const res = await apiSetReceivedTotal(task.id, parsedReceived);
        if (!res || res.ok === false) {
          console.warn('[EngineerTaskDetailScreen] receivedTotal 사전 저장 실패:', res?.error);
        }
      } catch (e) {
        console.warn('[EngineerTaskDetailScreen] receivedTotal 사전 저장 예외:', e?.message);
      } finally {
        setSaving(false);
      }
    }
    setSubScreen(target);
  }

  // 흐름에 따라 어느 persist 함수를 쓸지 통합
  const persistAndNavigate = usesReceivedTotalFlow
    ? persistReceivedTotalAndNavigate
    : persistExtraFeeAndNavigate;

  // 완료 분기 화면에 넘길 task override (extraFee 는 화면에서 표시용)
  //   신규 흐름: receivedTotal + 트리거 공식으로 derived extraFee 둘 다 명시
  //   옛 흐름: extraFee 만 (기존 동작)
  const completionTaskOverride = usesReceivedTotalFlow
    ? { receivedTotal: parsedReceived, extraFee: derivedExtra }
    : { extraFee: parsedExtra };

  if (!task) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
        작업 정보 없음
      </div>
    );
  }

  // 부분 취소 / 일정 변경 화면
  if (subScreen === "cancel") {
    return (
      <CancelScreen
        task={task}
        itemEngineerAmounts={itemEngineerAmounts}
        onBack={() => setSubScreen(null)}
        onConfirm={(payload) => {
          handleCancel(payload);
          setSubScreen(null);
          onBack && onBack();
        }}
      />
    );
  }
  if (subScreen === "reschedule") {
    return (
      <RescheduleScreen
        task={task}
        onBack={() => setSubScreen(null)}
        onConfirm={(payload) => {
          handleReschedule(payload);
          setSubScreen(null);
          onBack && onBack();
        }}
      />
    );
  }

  // V14 — 완료 분기 3가지
  if (subScreen === "complete") {
    return (
      <CompletionCompleteScreen
        task={{ ...task, ...completionTaskOverride }}
        photos={photos}
        onBack={() => setSubScreen(null)}
        onConfirm={(payload) => {
          onUpdate && onUpdate(task.id, {
            status: "완료",
            completedAt: getCurrentTime(),
            photos: photos.map(p => ({ url: p.url, step: p.step })),
            ...completionTaskOverride,
            workMemo: workMemo + (payload.memo ? "\n[마무리] " + payload.memo : ""),
          });
          setSubScreen(null);
          onBack && onBack();
        }}
      />
    );
  }
  if (subScreen === "partial") {
    return (
      <TaskPartialScreen
        task={{ ...task, ...completionTaskOverride }}
        photos={photos}
        onBack={() => setSubScreen(null)}
        onConfirm={async (payload) => {
          // 2026-05-25 Round 1 마이그 070 적용 — qty=0 대신 is_canceled=true:
          //   newQty===0: is_canceled=true + canceled_reason + canceled_at UPDATE.
          //               qty 원본 유지. 070 BEFORE 트리거가 customer_paid·net=0 + metadata 백업,
          //               AFTER 트리거가 tasks.product_price 자동 동기.
          //   newQty>0 && newQty<originalQty: 옛 spec 유지 — qty UPDATE.
          //               (부분수량 감소는 별도 모델 — 본 Round 1 범위 외)
          //   변경 없음: skip.
          // 이후 task_items_compute_trg(Mig 028)가 compute_payment v15(071) 호출 → payments 재계산.
          try {
            const nowIso = new Date().toISOString();
            for (const u of (payload.itemUpdates || [])) {
              if (!Number.isFinite(u.newQty) || u.newQty === u.originalQty) continue;
              if (u.newQty === 0) {
                await supabase
                  .from("task_items")
                  .update({
                    is_canceled: true,
                    canceled_reason: payload.reasonId || null,
                    canceled_at: nowIso,
                  })
                  .eq("id", u.id);
              } else {
                await supabase
                  .from("task_items")
                  .update({ qty: u.newQty })
                  .eq("id", u.id);
              }
            }
          } catch (e) {
            console.warn("[partial] task_items UPDATE 실패:", e?.message);
          }
          // 2026-05-30 — Phase B Step 4 — 신규 흐름 received_total 별도 persist.
          //   task_items 변경으로 product_price 가 자동 sync 된 후, received_total UPDATE 시
          //   BEFORE 트리거가 새 product_price 기준으로 extra_fee 자동 재계산.
          if (usesReceivedTotalFlow && payload.receivedTotal != null) {
            const currentDb = Number(task.receivedTotal ?? 0);
            if (Number(payload.receivedTotal) !== currentDb) {
              try {
                const res = await apiSetReceivedTotal(task.id, Number(payload.receivedTotal));
                if (!res || res.ok === false) {
                  console.warn('[partial] receivedTotal UPDATE 실패:', res?.error);
                }
              } catch (e) {
                console.warn('[partial] receivedTotal UPDATE 예외:', e?.message);
              }
            }
          }
          // onUpdate override — 부분완료 후 in-memory task 일치화.
          //   신규 흐름: 새 product_price (= payload.baseAmount), 사용자 받은 돈, derived extraFee.
          //   옛 흐름:   completionTaskOverride 그대로 (extraFee 진행중 입력값).
          const partialOverride = usesReceivedTotalFlow && payload.receivedTotal != null
            ? {
                receivedTotal: Number(payload.receivedTotal),
                productPrice:  Number(payload.baseAmount) || 0,
                extraFee:      Math.max(Number(payload.receivedTotal) - (Number(payload.baseAmount) || 0), 0),
              }
            : completionTaskOverride;
          onUpdate && onUpdate(task.id, {
            status: "완료",
            completedAt: getCurrentTime(),
            partialReason: payload.reasonId,
            partialMemo: payload.autoMemo,
            photos: photos.map(p => ({ url: p.url, step: p.step })),
            ...partialOverride,
            workMemo: workMemo,
          });
          setSubScreen(null);
          onBack && onBack();
        }}
      />
    );
  }
  if (subScreen === "visitOnly") {
    return (
      <TaskVisitOnlyScreen
        task={task}
        photos={photos}
        onBack={() => setSubScreen(null)}
        onConfirm={async (payload) => {
          // 2026-05-22 Phase 2 — mark_visit_only RPC 측 원자적 처리.
          // 옛 onUpdate({status:'visit_only', extraFee:30000}) 흐름은 4 곳 깨진 곳 (status enum / 정산 컬럼 / task_items / trigger) 측 동작 X.
          // RPC 측 task_items 재구성 + tasks UPDATE + payments 직접 INSERT 한 트랜잭션 처리.
          const res = await markVisitOnlyAdapter(task.id, payload.reasonId, payload.memo);
          if (!res?.ok) {
            alert(`출장비 처리 실패: ${res?.error || "알 수 없는 오류"}`);
            return;
          }
          // Optimistic UI — status 즉시 반영 (apiUpdateTask 후속 호출도 053 적용 후엔 정상).
          // RPC 측 이미 DB 변경 완료 → 다음 fetchTasks refetch 측 일관 동기화.
          onUpdate && onUpdate(task.id, {
            status: "visit_only",
            completedAt: getCurrentTime(),
          });
          setSubScreen(null);
          onBack && onBack();
        }}
      />
    );
  }
  // 2026-05-22 — 냉매 동의서 (Phase 1)
  if (subScreen === "consent") {
    return (
      <RefrigerantConsentScreen
        task={task}
        onBack={() => setSubScreen(null)}
        onComplete={(consent) => {
          // saveConsentAdapter 측 이미 DB 반영 — 로컬 task 캐시 갱신 위해 onUpdate 호출
          // (category_data 전체 덮어쓰기 회피 — consent 키만 별도 머지 신호 전달)
          onUpdate && onUpdate(task.id, { consent });
          setSubScreen(null);
        }}
        onReject={() => {
          // Phase 2 — visit_only 정산 정상화 후 본격 연결. 현재는 라우팅만.
          setSubScreen("visitOnly");
        }}
      />
    );
  }

  const isConfirmed = task.status === "확정";
  const isInProgress = task.status === "진행중";
  const isCompleted = task.status === "완료" || task.status === "visit_only";
  const isWaiting = task.status === "미배정";

  // ──────────── 액션 핸들러 ────────────
  function handleStartTask() {
    onUpdate && onUpdate(task.id, {
      status: "진행중",
      startedAt: getCurrentTime(),
    });
  }

  async function handlePhotoChange(e, step) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const res = await uploadPhoto(task.id, file, step);
        if (res?.ok && res?.url) {
          setPhotos(prev => [...prev, { url: res.url, step }]);
        } else {
          alert("사진 업로드 실패: " + (res?.error || "unknown"));
        }
      } catch (err) {
        console.error("사진 업로드 박지 X:", err);
        alert("사진 업로드 실패: " + err.message);
      }
    }
  }

  function handleRemovePhoto(idx) {
    setPhotos(prev => {
      const next = [...prev];
      try { if (next[idx]?.url?.startsWith("blob:")) URL.revokeObjectURL(next[idx].url); } catch {}
      next.splice(idx, 1);
      return next;
    });
  }

  function handleCompleteReport() {
    if (photos.length < PHOTO_MIN) {
      alert(`사진은 최소 ${PHOTO_MIN}장 필요합니다.`);
      return;
    }
    // [DEBUG remit-complete] extraFee 흐름 catch
    console.log('[remit-complete debug]', {
      extraFee_state: extraFee,
      extraFee_typeof: typeof extraFee,
      extraFee_parsed: parseInt(extraFee || "0", 10),
      workMemo: workMemo,
      photos_count: photos.length,
    });
    onUpdate && onUpdate(task.id, {
      status: "완료",
      completedAt: getCurrentTime(),
      photos: photos.map(p => ({ url: p.url, step: p.step })),
      photoBefore: true,
      photoAfter: true,
      beforePhoto: true,
      afterPhoto: true,
      ...completionTaskOverride,
      workMemo: workMemo,
    });
    onBack && onBack();
  }

  function handleVisitOnly(reasonId) {
    onUpdate && onUpdate(task.id, {
      status: "visit_only",
      visitOnlyReason: reasonId,
      completedAt: getCurrentTime(),
      extraFee: 30000,
    });
    setVisitOnlyOpen(false);
    onBack && onBack();
  }

  // 2026-05-25 Round 3 — 옛 onUpdate(updateTaskAdapter) 경로는 RLS 측 0행 → 화면 되돌아감.
  //   reschedule_engineer_task RPC (Migration 076) 로 직접 호출. KST 기준 ISO 조합.
  // 2026-05-27 — reason 살림. RPC 갱신본이 category_data.rescheduleReason 에 머지.
  //   (endTime / rescheduledAt 은 여전히 tasks 컬럼 부재 — 옛에도 무시됐음.)
  async function handleReschedule({ newDate, newStart, /* newEnd, */ reason }) {
    if (!task?.id || !newDate || !newStart) return;
    const iso = `${newDate}T${newStart}:00+09:00`;  // KST 기준
    const trimmedReason = reason ? String(reason).trim() : "";
    // Optimistic — 즉시 화면 갱신 (실패 시 onUpdate 가 fetchTasks 측 회복)
    const optimistic = {
      scheduledDate: newDate,
      scheduledTime: newStart,
      scheduledAt:   iso,
    };
    if (trimmedReason) {
      // category_data 머지 — 다른 키(reassignRequest 등) 보존
      optimistic.categoryData = {
        ...(task.categoryData || task.category_data || {}),
        rescheduleReason: trimmedReason,
        rescheduledAt:    new Date().toISOString(),
      };
    }
    onUpdate && onUpdate(task.id, optimistic);
    const res = await rescheduleEngineerTask(task.id, iso, trimmedReason || null);
    if (!res || res.ok === false) {
      alert(`일정 변경 실패: ${res?.error || "알 수 없는 오류"}`);
    }
  }

  function handleCancel({ items, reason, memo }) {
    const allItems = getTaskItems(task, itemEngineerAmounts);
    if (items.length < allItems.length) {
      const remaining = allItems.filter(i => !items.find(c => c.id === i.id));
      onUpdate && onUpdate(task.id, {
        items: remaining,
        cancelledItems: [...(task.cancelledItems || []), ...items],
        cancelReason: reason,
        cancelMemo: memo,
      });
    } else {
      onUpdate && onUpdate(task.id, {
        status: "취소",
        cancelReason: reason,
        cancelMemo: memo,
        cancelledAt: getCurrentTime(),
      });
    }
  }

  function addExtra(amount) {
    const cur = parseInt(extraFee || "0", 10);
    setExtraFee(String(cur + amount));
  }
  // 2026-05-30 — Phase B Step 3 — 신규 흐름 받은 돈 quick add
  function addReceived(amount) {
    const cur = parseInt(receivedTotal || "0", 10);
    setReceivedTotal(String(cur + amount));
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 100,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          ← 뒤로
        </button>
        <div style={{
          flex: 1, textAlign: "center",
          fontSize: 11, color: "var(--text-secondary)",
          fontFamily: "inherit",
        }}>
          {task.taskNo || task.id || "—"}
        </div>
        {/* 2026-05-25 — ⋮ 메뉴 제거. 일정변경/재배정/취소 는 하단 '일정 변경 · 취소' 카드로 통합. */}
        <div style={{ width: 56 }} aria-hidden="true"/>
      </div>

      {/* V14 — 확정/진행중 = 통합 메인 카드 (시간 + 작업 항목 + 고객) */}
      {(isConfirmed || isInProgress) && <WorkMainCard task={task} itemEngineerAmounts={itemEngineerAmounts}/>}
      {isCompleted && <StatusBlockCompleted task={task}/>}
      {isWaiting && <StatusBlockWaiting task={task}/>}

      {/* 완료/대기 — 작업 항목 별도 (확정/진행중은 WorkMainCard 안에 통합됨) */}
      {(isCompleted || isWaiting) && <TaskItemsList task={task} itemEngineerAmounts={itemEngineerAmounts}/>}

      {/* 영역 3 — 요청사항 + 운영 메모 + 전화/문자 (확정/진행중은 고객 헤더 숨김) */}
      <CustomerInfo task={task} hideCustomerHeader={isConfirmed || isInProgress} user={user} onMemoAdd={onMemoAdd}/>

      {/* V14 — 길찾기 (확정만 / 네이버 + T맵) */}
      {isConfirmed && <MapButtons task={task}/>}

      {/* 진행중 — 사진 / 추가금 / 메모 */}
      {isInProgress && (
        <>
          <PhotoSection
            photos={photos}
            beforeFileRef={beforeFileRef}
            afterFileRef={afterFileRef}
            onPhotoChange={handlePhotoChange}
            onRemove={handleRemovePhoto}
          />
          {usesReceivedTotalFlow ? (
            <ReceivedTotalInput
              value={receivedTotal}
              onChange={setReceivedTotal}
              onAdd={addReceived}
              baseAmount={task.estimateTotal || 0}
            />
          ) : (
            <ExtraFeeInput
              value={extraFee}
              onChange={setExtraFee}
              onAdd={addExtra}
              baseAmount={task.estimateTotal || 0}
            />
          )}
          <WorkMemoInput value={workMemo} onChange={setWorkMemo}/>
        </>
      )}

      {/* 완료 — 등록된 사진 + 메모 + 정산 */}
      {isCompleted && (
        <>
          <CompletedPhotos task={task}/>
          {task.workMemo && <CompletedMemo memo={task.workMemo}/>}
          <SettlementInfo task={task}/>
        </>
      )}

      {/* 2026-05-25 — '일정 변경 · 취소' 카드는 화면 맨 아래 (작업 시작/완료 버튼 아래) 로 이동.
            여기 자리는 비움. 약속대기 안내 → 메인 CTA 흐름 그대로. */}

      {/* 약속대기 — 안내 */}
      {isWaiting && (
        <div style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{
            padding: 18,
            background: "var(--bg-secondary)",
            border: "1px dashed #FFB300",
            borderRadius: 10,
            color: "var(--text-secondary)",
            fontSize: 11,
          }}>
            🕐 일정 미정 — 고객 통화 후 일정 확정
          </div>
        </div>
      )}

      {/* V14 헌법 — 메인 CTA = 핑크 풀 (작업 종류 색 X) */}
      {/* 2026-05-22 — 냉매 작업 측 동의서 필수 가드 (Phase 1) */}
      {isConfirmed && (() => {
        // 2026-05-26 C-2 — workType 정확일치 → isRefrigerantWorkType (DB "냉매점검(...)" 측 catch).
        const isRefrigerant = isRefrigerantWorkType(task);
        const hasConsent = !!(task.consent?.signedAt);
        const startBlocked = isRefrigerant && !hasConsent;
        const signedAtLabel = hasConsent ? formatTimeOnly(task.consent.signedAt) : "";
        return (
        <div style={{ padding: "16px" }}>
          {/* 냉매 작업 — 동의 전: 동의서 버튼 / 동의 후: 완료 표시 */}
          {isRefrigerant && !hasConsent && (
            <button
              onClick={() => setSubScreen("consent")}
              style={{
                width: "100%", padding: 15,
                background: "#0F6E56", border: "none",
                borderRadius: 14, color: "#fff",
                fontSize: 15, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                marginBottom: 10,
              }}
            >
              📝 냉매 충전 동의서
            </button>
          )}
          {isRefrigerant && hasConsent && (
            <div style={{
              padding: "10px 12px", marginBottom: 10,
              background: "rgba(15,110,86,0.10)",
              border: "1px solid rgba(15,110,86,0.35)",
              borderRadius: 10,
              fontSize: 12, fontWeight: 700, color: "#0F6E56",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>✅ 동의 완료</span>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                · {task.consent.customerName}
              </span>
              {signedAtLabel && (
                <span style={{ color: "var(--text-tertiary)", fontWeight: 600, marginLeft: "auto", fontSize: 11 }}>
                  {signedAtLabel}
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleStartTask}
            disabled={startBlocked}
            style={{
              width: "100%", padding: 19,
              background: startBlocked ? "var(--bg-tertiary)" : "#FF1B8D",
              border: "none",
              borderRadius: 16,
              color: startBlocked ? "var(--text-tertiary)" : "#fff",
              fontSize: 18, fontWeight: 700,
              cursor: startBlocked ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            ▶ 작업 시작
          </button>
          <div style={{
            marginTop: 10, textAlign: "center",
            fontSize: 12, color: "#888", fontWeight: 600,
          }}>
            {startBlocked ? "동의서 완료 후 시작 가능" : "현장 도착 후 시작"}
          </div>
        </div>
        );
      })()}

      {isInProgress && (() => {
        const enough = photos.length >= PHOTO_MIN;
        return (
        <div style={{ padding: "14px 16px 22px" }}>
          {/* V14 — 메인 액션 (작업 완료 / 핑크 풀 V14 메인 액션) */}
          <button
            onClick={async () => {
              if (!enough) {
                alert(`사진은 최소 ${PHOTO_MIN}장 필요합니다.`);
                return;
              }
              await persistAndNavigate("complete");
            }}
            disabled={!enough || saving}
            style={{
              width: "100%", padding: 18,
              background: (enough && !saving) ? "#FF1B8D" : "var(--bg-tertiary)",
              border: "none", borderRadius: 16,
              color: (enough && !saving) ? "#fff" : "var(--text-tertiary)",
              fontSize: 17, fontWeight: 600,
              cursor: (enough && !saving) ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              marginBottom: 10,
            }}
          >
            {saving
              ? "저장 중..."
              : (enough ? "✓ 작업 완료" : `✓ 작업 완료 (사진 ${PHOTO_MIN}장 필요)`)}
          </button>

          {/* V14 헌법 — 부분 완료 = 회색 (중립) / 출장비만 = 빨강 (취소) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={() => persistAndNavigate("partial")}
              disabled={saving}
              style={{
                padding: 13,
                background: "transparent",
                border: "1.5px solid #C8C8C8",
                borderRadius: 12,
                color: "#555",
                fontSize: 14, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#888" }}/>
              부분 완료
            </button>
            <button
              onClick={() => persistAndNavigate("visitOnly")}
              disabled={saving}
              style={{
                padding: 13,
                background: "transparent",
                border: "1.5px solid #FF3B5C",
                borderRadius: 12,
                color: "var(--cancel-text)",
                fontSize: 14, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF3B5C" }}/>
              출장비만
            </button>
          </div>
        </div>
        );
      })()}

      {/* 2026-05-25 — ⋮ 메뉴(TaskMenu) 호출 제거. 항목은 '일정 변경 · 취소' 카드로 통합. */}

      {/* 2026-05-25 — '일정 변경 · 취소' 카드 (화면 맨 아래, 작업 시작/완료 버튼 아래).
            기본 접힘 — 헤더만 보이고 ▾. 탭 시 펼침 + 행 3개. (기사 실수 방지 spec)
            상태별 행:
              · 확정    : 일정 변경 / 재배정 요청 / 작업 취소 (3개)
              · 배정    : 재배정 요청 / 작업 취소 (2개)
              · 진행중  : 재배정 요청 / 부분 취소 (2개)
              · 그 외   : 카드 미표시.
            '작업 취소' / '부분 취소' 행은 빨강. */}
      {(() => {
        const isAssigned = task.status === "배정";
        const showCard   = isAssigned || isConfirmed || isInProgress;
        if (!showCard) return null;

        const hasReassignReq = !!(task.reassignRequest?.requestedAt);
        const reassignReqAt  = hasReassignReq ? formatTimeOnly(task.reassignRequest.requestedAt) : "";
        const reassignReason = hasReassignReq ? (task.reassignRequest.reason || "") : "";

        const ROW_STYLE = {
          width: "100%",
          padding: "13px 14px",
          background: "transparent",
          border: "none",
          color: "var(--text-primary)",
          fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 10,
          textAlign: "left",
        };
        const DIVIDER_STYLE = { height: 1, background: "var(--border)" };
        const ARROW = (
          <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: 14 }}>›</span>
        );

        const Row = ({ icon, label, danger, onClick }) => (
          <button
            onClick={onClick}
            style={{
              ...ROW_STYLE,
              color: danger ? "#FF3B5C" : "var(--text-primary)",
            }}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{icon}</span>
            <span>{label}</span>
            {ARROW}
          </button>
        );

        return (
          <div style={{ padding: "4px 16px 22px" }}>
            <div style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* 헤더 — 토글 (기본 접힘). 2줄 구조: 라벨 + 보조 안내. */}
              <button
                onClick={() => setActionsOpen(v => !v)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center",
                  textAlign: "left",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: "var(--text-secondary)",
                    letterSpacing: 0.2,
                  }}>
                    일정 변경 · 취소
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}>
                    일정 바꾸기 · 재배정 요청 · 작업 취소
                  </div>
                </div>
                <span style={{
                  marginLeft: 10,
                  fontSize: 13,
                  color: "var(--text-tertiary)",
                  transition: "transform 0.15s",
                  transform: actionsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block",
                  flexShrink: 0,
                }}>▾</span>
              </button>

              {/* 펼침 시 행 표시 */}
              {actionsOpen && (
                <>
                  <div style={DIVIDER_STYLE}/>

                  {isConfirmed && (
                    <>
                      <Row icon="🕐" label="일정 변경" onClick={() => setSubScreen("reschedule")}/>
                      <div style={DIVIDER_STYLE}/>
                    </>
                  )}

                  {hasReassignReq ? (
                    <div style={{
                      padding: "10px 14px",
                      background: "rgba(255,27,141,0.08)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 12, lineHeight: 1.6,
                    }}>
                      <div style={{ fontWeight: 700, color: "#FF1B8D", marginBottom: 2 }}>
                        🔁 재배정 요청됨 — 운영자 확인 대기{reassignReqAt ? ` (${reassignReqAt})` : ""}
                      </div>
                      {reassignReason && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          사유: {reassignReason}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Row icon="🔁" label="재배정 요청" onClick={() => onRequestReassign?.(task)}/>
                      <div style={DIVIDER_STYLE}/>
                    </>
                  )}

                  <Row
                    icon="⛔"
                    label={isInProgress ? "부분 취소" : "작업 취소"}
                    danger
                    onClick={() => setSubScreen("cancel")}
                  />
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 출장비만 다이얼로그 */}
      {visitOnlyOpen && (
        <VisitOnlyDialog
          task={task}
          onClose={() => setVisitOnlyOpen(false)}
          onConfirm={handleVisitOnly}
        />
      )}
    </div>
  );
}

// ──────────────── 상태 블록 ────────────────
// V14 — 통합 메인 카드 (시간 + 작업 항목 + 고객 / 좌측 4px 바 카드 전체 연속)
function WorkMainCard({ task, itemEngineerAmounts = {} }) {
  const colors = getWorkTypeColors(task.workType);
  const isDark = useIsDark();
  const labelColor = isDark ? colors.label.dark : colors.label.light;
  const isInProgress = task.status === "진행중";

  // 진행률 계산
  const pct = (() => {
    if (!task.startedAt || !task.endTime) return 0;
    const toMin = (s) => {
      const norm = formatTimeOnly(s);
      const [h, m] = String(norm || s).split(":");
      return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
    };
    const startMin = toMin(task.startedAt);
    const endMin   = toMin(task.endTime);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (endMin <= startMin) return 0;
    return Math.max(0, Math.min(100, ((nowMin - startMin) / (endMin - startMin)) * 100));
  })();

  const items = getTaskItems(task, itemEngineerAmounts);
  const dividerColor = "var(--border)";

  return (
    <div style={{
      margin: "14px 16px",
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 18,
      padding: "18px 18px 18px 22px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* 좌측 4px 작업 종류 색 바 (카드 전체 연속) */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: colors.main,
      }}/>

      {/* V14 v7 — 날짜 라인 (사장님 spec '5월 7일 (목) · 내일') */}
      {task.scheduledDate && (
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: workDateColor(task.scheduledDate),
          marginBottom: 10,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>📅</span>
          <span>{workDateLabel(task.scheduledDate)}</span>
        </div>
      )}

      {/* 영역 1 — 상태 + N 마크 (유솔N 세척만) + 시간 + (진행중인 경우 시작 시각 우측) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: labelColor,
        }}/>
        <span style={{ fontSize: 14, color: labelColor, fontWeight: 700 }}>
          {isInProgress ? "진행중" : "확정"}
        </span>
        {(task.client === '유솔홈케어 N' || task.principalId === 'usol_n') && (task.workType || '').includes('세척') && (
          <span style={{
            background: '#03C75A', color: 'white',
            fontSize: 9, padding: '2px 5px',
            borderRadius: 4, fontWeight: 800,
            marginLeft: 4,
          }}>N</span>
        )}
        {isInProgress && task.startedAt && (
          <span style={{
            marginLeft: "auto",
            fontSize: 13, color: "var(--label-main)", fontWeight: 700,
          }}>
            {formatTimeOnly(task.startedAt)} 시작
          </span>
        )}
      </div>

      {/* 시간 (Hero 36px) */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 36, fontWeight: 700,
          fontFamily: "inherit",
          color: "var(--text-primary)",
          letterSpacing: "-1px", lineHeight: 1,
        }}>
          {formatTimeOnly(isInProgress ? task.startedAt : task.scheduledTime) || formatTimeOnly(task.time) || "—"}
        </span>
        {task.endTime && (
          <span style={{ fontSize: 18, color: "#888", fontWeight: 700 }}>
            ~ {formatTimeOnly(task.endTime) || task.endTime}
          </span>
        )}
      </div>

      {/* 진행중 = progress bar / 확정 = 📅 예정 시각 */}
      {isInProgress && task.startedAt && task.endTime ? (
        <div style={{
          height: 4, borderRadius: 2,
          background: "var(--progress-bg)",
          overflow: "hidden",
          marginTop: 12, marginBottom: 16,
        }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: colors.main,
            borderRadius: 2,
          }}/>
        </div>
      ) : (
        <div style={{
          fontSize: 13, color: "var(--label-main)",
          marginTop: 8, marginBottom: 16, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {/* 2026-05-25 — 큰 시간(Hero 36px) 과 중복 제거. 라벨만. */}
          <span style={{ fontSize: 14 }}>📅</span> 예정 시각
        </div>
      )}

      {/* 영역 2 — 작업 항목 (구분선) */}
      {items.length > 0 && (
        <div style={{
          borderTop: `0.5px solid ${dividerColor}`,
          paddingTop: 14, marginBottom: 14,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item, idx) => (
              <WorkItemRow
                key={item.id}
                workType={(item.serviceType || task).workType}
                appliance={item.name}
                qty={item.qty}
                price={item.price}
                client={task.client}
                dividerTop={idx > 0}
                isCanceled={item.isCanceled}
              />
            ))}
          </div>
        </div>
      )}

      {/* 영역 3 — 고객 정보 (구분선) */}
      <div style={{
        borderTop: `0.5px solid ${dividerColor}`,
        paddingTop: 14,
      }}>
        <div style={{
          fontSize: 26, fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.4px",
          marginBottom: 6,
        }}>
          {task.customer || "—"}님
        </div>
        {task.phone && (
          <div style={{
            fontSize: 14, color: "var(--label-main)",
            fontWeight: 700, marginBottom: 4,
          }}>
            📞 {task.phone}
          </div>
        )}
        <AddressLine task={task} baseStyle={{
          fontSize: 14, color: "var(--label-main)", fontWeight: 700,
        }}/>
      </div>
    </div>
  );
}

function StatusBlockConfirmed({ task }) {
  const colors = getWorkTypeColors(task.workType);
  const isDark = useIsDark();
  const labelColor = isDark ? colors.label.dark : colors.label.light;
  return (
    <div style={{ padding: "18px 18px 14px 22px", borderBottom: "1px solid var(--border)", position: "relative" }}>
      {/* 좌측 4px 작업 종류 색 바 */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: colors.main,
      }}/>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: labelColor }}/>
          <span style={{ fontSize: 14, color: labelColor, fontWeight: 700 }}>
            확정
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <div style={{
          fontSize: 36, fontWeight: 600, fontFamily: "inherit",
          color: "var(--text-primary)", letterSpacing: "-1px",
        }}>
          {task.scheduledTime || task.time || "—"}
        </div>
        {task.endTime && (
          <div style={{ fontSize: 16, color: "#888", fontWeight: 600 }}>
            ~ {task.endTime}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
        📅 {formatTimeUntilStart(task)}
      </div>
    </div>
  );
}

function StatusBlockInProgress({ task }) {
  const colors = getWorkTypeColors(task.workType);
  const isDark = useIsDark();
  const labelColor = isDark ? colors.label.dark : colors.label.light;
  // V14 — 진행률 계산
  const pct = (() => {
    if (!task.startedAt || !task.endTime) return 0;
    const toMin = (s) => {
      const norm = formatTimeOnly(s);
      const [h, m] = String(norm || s).split(":");
      return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
    };
    const startMin = toMin(task.startedAt);
    const endMin   = toMin(task.endTime);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (endMin <= startMin) return 0;
    return Math.max(0, Math.min(100, ((nowMin - startMin) / (endMin - startMin)) * 100));
  })();

  return (
    <div style={{ padding: "18px 18px 14px 22px", borderBottom: "1px solid var(--border)", position: "relative" }}>
      {/* 좌측 4px 작업 종류 색 바 */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: colors.main,
      }}/>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: labelColor }}/>
          <span style={{ fontSize: 14, color: labelColor, fontWeight: 700 }}>
            진행중
          </span>
        </div>
        {task.startedAt && (
          <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>
            {formatTimeOnly(task.startedAt)} 시작
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
        <div style={{
          fontSize: 36, fontWeight: 600, fontFamily: "inherit",
          color: "var(--text-primary)", letterSpacing: "-1px",
        }}>
          {formatTimeOnly(task.startedAt) || formatTimeOnly(task.scheduledTime) || "—"}
        </div>
        {task.endTime && (
          <div style={{ fontSize: 16, color: "#888", fontWeight: 600 }}>
            ~ {formatTimeOnly(task.endTime) || task.endTime}
          </div>
        )}
      </div>

      {/* V14 — progress bar (작업 종류 색) */}
      {task.startedAt && task.endTime && (
        <div style={{
          height: 4, borderRadius: 2,
          background: "var(--progress-bg)",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: colors.main,
            transition: "width 0.3s",
          }}/>
        </div>
      )}
    </div>
  );
}

function StatusBlockCompleted({ task }) {
  const isVisitOnly = task.status === "visit_only";
  // 2026-05-24 — 시트 import된 완료 작업은 startedAt NULL → "── ~ 00:00 / 총 ── 작업" 깨짐
  //   startedAt 없으면 완료일만 간결 표시 (PWA로 완료한 작업은 기존 시작~완료 + 소요시간 그대로)
  const hasStartedAt = !!task.startedAt;
  const completedYmd = task.completedAt
    ? (() => {
        const d = new Date(task.completedAt);
        if (isNaN(d.getTime())) return "";
        // KST 변환 — completed_at이 KST 자정 → UTC 전날 15:00이라 +9h로 한국 날짜 복원
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        const mm = kst.getUTCMonth() + 1;
        const dd = kst.getUTCDate();
        return `${mm}월 ${dd}일`;
      })()
    : "";
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px",
        background: "rgba(0,135,90,0.15)",
        border: "1px solid #00875A",
        borderRadius: 14, marginBottom: 12,
      }}>
        <span style={{ fontSize: 10 }}>✓</span>
        <span style={{ fontSize: 10, color: "#00875A", fontWeight: 700 }}>
          {isVisitOnly ? "출장비만" : "완료"}
        </span>
      </div>
      {/* 2026-05-22 — visit_only 측 startedAt NULL → "총 — 작업" 깨짐 → 별도 간결 표시 */}
      {isVisitOnly ? (
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          출장비만 처리 · {formatTimeOnly(task.completedAt) || "—"}
        </div>
      ) : hasStartedAt ? (
        // PWA로 진행한 작업 — 시작 ~ 완료 + 소요 시간 (기존)
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
            <div style={{
              fontSize: 28, fontWeight: 700, fontFamily: "inherit",
              color: "var(--text-primary)",
            }}>
              {formatTimeOnly(task.startedAt) || "—"}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              ~ {formatTimeOnly(task.completedAt) || "—"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            총 {calcTotalDuration(task.startedAt, task.completedAt)} 작업
          </div>
        </>
      ) : (
        // 시트 import된 완료 작업 — startedAt 없음 → 완료일만
        <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 600 }}>
          {completedYmd ? `${completedYmd} 완료` : "작업 완료"}
        </div>
      )}
    </div>
  );
}

function StatusBlockWaiting({ task }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px",
        background: "rgba(255,179,0,0.15)",
        border: "1px solid #FFB300",
        borderRadius: 14, marginBottom: 12,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFB300" }}/>
        <span style={{ fontSize: 10, color: "#FFB300", fontWeight: 700 }}>
          약속미정
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700 }}>
        {task.requestedDate || "—"}{task.requestedTime ? ` · ${task.requestedTime}` : ""} 희망
      </div>
    </div>
  );
}

// ──────────────── 작업 항목 (진행중) ────────────────
// V14 — 작업 항목 한 줄 박스 (단일 항목 / 컬러 박스 + 작업명 + 단가)
function TaskItemsList({ task, itemEngineerAmounts = {} }) {
  const items = getTaskItems(task, itemEngineerAmounts);
  if (items.length === 0) return null;
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, idx) => (
          <WorkItemRow
            key={item.id}
            workType={(item.serviceType || task).workType}
            appliance={item.name}
            qty={item.qty}
            price={item.price}
            client={task.client}
            dividerTop={idx > 0}
            isCanceled={item.isCanceled}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────── 고객 + 요청사항 + 운영팀 메모 ────────────────
function CustomerInfo({ task, hideCustomerHeader = false, user, onMemoAdd }) {
  // 2026-05-27 Phase 2 — task_memos hook (Supabase, realtime 자동 갱신).
  //   CustomerInfo 안의 "💬 메모" 카드 JSX 가 이 변수 사용.
  //   직전 14e733b 에서 선언이 부모(EngineerTaskDetailScreen)에 있어 ReferenceError 발생.
  const { memos: taskMemos } = useTaskMemos(task?.id);
  const isInProgress = task.status === "진행중";
  const isCompleted = task.status === "완료" || task.status === "visit_only";
  const isConfirmed = task.status === "확정";
  const operatorNote = task.operatorNote || task.happycallMemo;

  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      {/* V14 — 고객명/전화/주소: WorkMainCard에서 표시 시 숨김 */}
      {!hideCustomerHeader && (
        <>
          <div style={{
            fontSize: 26, fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            marginBottom: 6,
          }}>
            {task.customer || "—"}님
          </div>
          {task.phone && (
            <div style={{
              fontSize: 14, color: "var(--text-secondary)",
              fontWeight: 600, marginBottom: 4,
            }}>
              📞 {task.phone}
            </div>
          )}
          <AddressLine task={task} baseStyle={{
            fontSize: 14, color: "var(--text-secondary)",
            fontWeight: 600, marginBottom: 12,
          }} iconColor="var(--text-secondary)"/>
        </>
      )}

      {/* 2026-05-29 — 결제 방식 라벨 (선택값 있을 때만 / NULL 숨김) */}
      {task.paymentMethod && (
        <div style={{
          fontSize: 14, color: "var(--text-secondary)",
          fontWeight: 600, marginBottom: 12,
        }}>
          💳 결제: {PAYMENT_METHOD_LABELS[task.paymentMethod] || task.paymentMethod}
        </div>
      )}

      {/* V14 — 요청사항 (노랑 박스 + 좌측 3px 노란 바) */}
      {task.requestNote && (
        <div style={{
          position: "relative",
          background: "var(--request-bg)",
          borderRadius: 8,
          padding: "10px 12px 10px 14px",
          marginTop: 12, marginBottom: 10,
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 3, background: "#FFB800",
          }}/>
          <div style={{
            fontSize: 12, color: "var(--request-text)",
            fontWeight: 600, marginBottom: 4,
          }}>
            📝 요청사항 (고객)
          </div>
          <div style={{
            fontSize: 13, color: "var(--request-sub)",
            fontWeight: 600, lineHeight: 1.5,
          }}>
            {task.requestNote}
          </div>
        </div>
      )}

      {/* 2026-05-27 — 내가 남긴 협의 메모 (새 배정 화면에서 입력 / category_data.callMemo 평탄화) */}
      {task.callMemo && (
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 4 }}>
            📞 내가 남긴 협의 메모 (고객 통화)
          </div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.5 }}>
            {task.callMemo}
          </div>
        </div>
      )}

      {/* 2026-05-27 — 내가 남긴 일정 변경 사유 (category_data.rescheduleReason 평탄화).
            RescheduleScreen 에서 입력한 reason 이 RPC v2(2026-05-27) 가 머지. */}
      {task.rescheduleReason && (
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 4 }}>
            🕐 내가 남긴 일정 변경 사유
          </div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.5 }}>
            {task.rescheduleReason}
          </div>
          {task.rescheduledAt && (
            <div style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 4 }}>
              {String(task.rescheduledAt).slice(0, 16).replace("T", " ")}
            </div>
          )}
        </div>
      )}

      {/* 2026-05-27 Phase 2 — 작업 메모 (운영자↔기사 양방향, task_memos 테이블) */}
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 10,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700 }}>
            💬 메모 ({taskMemos.length})
          </div>
          {onMemoAdd && (
            <button
              onClick={onMemoAdd}
              style={{
                fontSize: 11, color: "var(--accent)",
                background: "transparent", border: "none",
                cursor: "pointer", padding: 0, fontWeight: 700,
                fontFamily: "inherit",
              }}
            >+ 메모 추가</button>
          )}
        </div>
        {taskMemos.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--text-tertiary, var(--text-secondary))", padding: "4px 0" }}>
            아직 메모가 없습니다
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {taskMemos.map(m => (
              <div key={m.id} style={{
                background: "var(--bg-elevated)",
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
                <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {m.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* V14 — 운영팀 메모 (보라 박스 + 좌측 3px 보라 바) */}
      {operatorNote && (
        <div style={{
          position: "relative",
          background: "var(--ops-memo-bg)",
          borderRadius: 8,
          padding: "10px 12px 10px 14px",
          marginBottom: 12,
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 3, background: "#7B61FF",
          }}/>
          <div style={{
            fontSize: 12, color: "var(--ops-memo-header)",
            fontWeight: 600, marginBottom: 4,
          }}>
            📌 운영팀 메모
          </div>
          <div style={{
            fontSize: 13, color: "var(--ops-memo-body)",
            fontWeight: 600, lineHeight: 1.5,
          }}>
            {operatorNote}
          </div>
        </div>
      )}

      {/* 2026-05-25 — 톤다운: 풀 컬러 → 중립 배경 + 작은 컬러 아이콘 */}
      {!isCompleted && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={() => makeCall(task.phone)} style={{
            padding: 12,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text-primary)",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <span style={{ color: "#22C55E", fontSize: 15 }}>📞</span>
            전화
          </button>
          <button onClick={() => sendSms(task.phone)} style={{
            padding: 12,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text-primary)",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <span style={{ color: "#3B82F6", fontSize: 15 }}>💬</span>
            문자
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────── 이동 정보 (확정만) ────────────────
// 2026-05-20 Phase 5 Step 0.F-10 A안 — T맵 (#EE2737 채움) / 카카오맵 (#FEE500 채움)
function MapButtons({ task }) {
  function openTmapBtn()   { openTmap(task); }
  function openKakaoBtn()  { openKakaoMap(task); }
  return (
    <div style={{ padding: "0 16px 14px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
      }}>
        {/* 2026-05-25 — 톤다운: 풀 컬러 → 중립 배경 + 작은 컬러 아이콘 (T·K 라벨만 브랜드색 유지) */}
        <button onClick={openTmapBtn} style={{
          padding: 12,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text-primary)",
          fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 4,
            background: "#EE2737", color: "#fff",
            fontSize: 11, fontWeight: 800,
          }}>T</span>
          T맵
        </button>
        <button onClick={openKakaoBtn} style={{
          padding: 12,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text-primary)",
          fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 4,
            background: "#FEE500", color: "#181600",
            fontSize: 11, fontWeight: 800,
          }}>K</span>
          카카오맵
        </button>
      </div>
    </div>
  );
}

// ──────────────── 사진 전/후 (진행중) ────────────────
// V14 — 사진 그리드 (분류 X / 최소 N장 / 그리드 + 추가)
function PhotoGrid({ photos, minRequired = 2, onAdd, onRemove }) {
  const isOK = photos.length >= minRequired;
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            📷 사진
          </div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontWeight: 600, marginTop: 2,
          }}>
            {minRequired}장 이상 필수
          </div>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: isOK ? "#03C75A" : "var(--text-secondary)",
          padding: "4px 10px",
          background: isOK ? "rgba(3,199,90,0.10)" : "var(--bg-secondary)",
          border: `1px solid ${isOK ? "rgba(3,199,90,0.30)" : "var(--border)"}`,
          borderRadius: 6,
        }}>
          {photos.length} / {minRequired}{isOK ? " ✓" : ""}
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
      }}>
        {photos.map((url, idx) => (
          <div key={idx} style={{
            position: "relative",
            aspectRatio: "1",
            background: url && url.startsWith("blob:")
              ? `url(${url}) center/cover`
              : "rgba(3,199,90,0.10)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {(!url || !url.startsWith("blob:")) && (
              <div style={{ fontSize: 28, color: "#03C75A" }}>✓</div>
            )}
            <button
              onClick={() => onRemove && onRemove(idx)}
              style={{
                position: "absolute", top: 4, right: 4,
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(0,0,0,0.6)", border: "none",
                color: "#fff", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
              }}
              aria-label="사진 삭제"
            >×</button>
          </div>
        ))}
        <button
          onClick={onAdd}
          style={{
            aspectRatio: "1",
            background: "var(--bg-secondary)",
            border: "2px dashed #FF1B8D",
            borderRadius: 8,
            color: "#FF1B8D",
            fontSize: 22, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 2,
          }}
          aria-label="사진 추가"
        >
          <span style={{ fontSize: 24 }}>📷</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>추가</span>
        </button>
      </div>
    </div>
  );
}

// V14 — 추가금 (옅은 주황 톤)
// 2026-05-21 — 견적금액 안내 카드 + 실시간 총액 표시 추가 (사장님 spec)
function ExtraFeeInput({ value, onChange, onAdd, baseAmount = 0 }) {
  const extraNum = Number(value) || 0;
  const total = baseAmount + extraNum;
  const isUndecided = baseAmount === 0;
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        background: "var(--extra-fee-bg)",
        borderRadius: 12,
        padding: 14,
      }}>
        <div style={{
          fontSize: 13, color: "var(--extra-fee-header)",
          fontWeight: 600, marginBottom: 10,
        }}>
          💰 현장 추가금 (있으면)
        </div>

        {/* 2026-05-21 — 견적금액 안내 카드 (사장님 spec) */}
        <div style={{
          padding: "10px 12px", marginBottom: 10,
          background: "var(--card-bg)",
          border: `1px solid ${isUndecided ? "var(--warning)" : "var(--border)"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, fontWeight: 600,
          color: isUndecided ? "var(--warning)" : "var(--text-secondary)",
        }}>
          <span>견적금액</span>
          {isUndecided ? (
            <span style={{ fontStyle: "italic" }}>미정 (현장 확정)</span>
          ) : (
            <span className="mono" style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>
              ₩{baseAmount.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", padding: 12,
            background: "var(--card-bg)",
            border: "1px solid var(--extra-fee-border)",
            borderRadius: 10,
            color: "var(--text-primary)",
            fontSize: 16, boxSizing: "border-box",
            outline: "none", marginBottom: 10,
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
        }}>
          {[
            { amount: 5000,   label: "+5천"  },
            { amount: 10000,  label: "+1만"  },
            { amount: 50000,  label: "+5만"  },
            { amount: 100000, label: "+10만" },
          ].map(b => (
            <button
              key={b.amount}
              onClick={() => onAdd(b.amount)}
              style={{
                padding: 8,
                background: "var(--card-bg)",
                border: "1px solid var(--extra-fee-border)",
                borderRadius: 8,
                color: "var(--extra-fee-text)",
                fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
          >
            {b.label}
          </button>
        ))}
        </div>

        {/* 2026-05-21 — 실시간 총액 (추가금 > 0 측만) */}
        {extraNum > 0 && (
          <div style={{
            marginTop: 10, padding: "8px 12px",
            background: "var(--card-bg)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12, fontWeight: 700,
            color: "var(--text-primary)",
          }}>
            <span>총액</span>
            <span className="mono" style={{ color: "var(--accent)", fontSize: 14 }}>
              ₩{total.toLocaleString("ko-KR")}
              {!isUndecided && (
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500, marginLeft: 6 }}>
                  = 견적 + 추가
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// 2026-05-30 — Phase B Step 3 — 고객 결제 총액 입력 (신규 흐름).
//   사용자가 입력 = received_total. DB BEFORE 트리거가 extra_fee 자동 sync.
//   자동 계산된 추가금 = GREATEST(received_total - product_price, 0). 트리거 공식과 동일.
//   분기: principalCode != 'usol_n' && paymentMethod != 'prepaid' 일 때만 렌더.
function ReceivedTotalInput({ value, onChange, onAdd, baseAmount = 0 }) {
  const receivedNum = Number(value) || 0;
  const isUndecided = baseAmount === 0;
  const autoExtra   = Math.max(receivedNum - baseAmount, 0);
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        background: "var(--extra-fee-bg)",
        borderRadius: 12,
        padding: 14,
      }}>
        <div style={{
          fontSize: 13, color: "var(--extra-fee-header)",
          fontWeight: 600, marginBottom: 2,
        }}>
          💰 고객 결제 총액
        </div>
        <div style={{
          fontSize: 11, color: "var(--text-tertiary)",
          fontWeight: 500, marginBottom: 10,
        }}>
          현장에서 받은 돈 (견적 + 추가금 합계)
        </div>

        {/* 견적 합 안내 카드 */}
        <div style={{
          padding: "10px 12px", marginBottom: 10,
          background: "var(--card-bg)",
          border: `1px solid ${isUndecided ? "var(--warning)" : "var(--border)"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, fontWeight: 600,
          color: isUndecided ? "var(--warning)" : "var(--text-secondary)",
        }}>
          <span>견적 합 (자동)</span>
          {isUndecided ? (
            <span style={{ fontStyle: "italic" }}>미정 (현장 확정)</span>
          ) : (
            <span className="mono" style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>
              ₩{baseAmount.toLocaleString("ko-KR")}
            </span>
          )}
        </div>

        {/* 받은 돈 입력 */}
        <input
          type="number"
          inputMode="numeric"
          placeholder="현장에서 받은 돈"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", padding: 12,
            background: "var(--card-bg)",
            border: "1px solid var(--extra-fee-border)",
            borderRadius: 10,
            color: "var(--text-primary)",
            fontSize: 16, boxSizing: "border-box",
            outline: "none", marginBottom: 10,
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        />

        {/* Quick add — 받은 돈에 더하기 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
        }}>
          {[
            { amount: 5000,   label: "+5천"  },
            { amount: 10000,  label: "+1만"  },
            { amount: 50000,  label: "+5만"  },
            { amount: 100000, label: "+10만" },
          ].map(b => (
            <button
              key={b.amount}
              onClick={() => onAdd(b.amount)}
              style={{
                padding: 8,
                background: "var(--card-bg)",
                border: "1px solid var(--extra-fee-border)",
                borderRadius: 8,
                color: "var(--extra-fee-text)",
                fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* 자동 계산된 추가금 + 총액 (받은 돈 > 0 일 때) */}
        {receivedNum > 0 && (
          <div style={{
            marginTop: 10, padding: "10px 12px",
            background: "var(--card-bg)",
            borderRadius: 8,
            display: "flex", flexDirection: "column", gap: 6,
            fontSize: 12, fontWeight: 700,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              color: "var(--text-secondary)",
            }}>
              <span>= 자동 계산된 추가금</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>
                ₩{autoExtra.toLocaleString("ko-KR")}
              </span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              color: "var(--text-primary)",
            }}>
              <span>총액 = 결제 총액</span>
              <span className="mono" style={{ color: "var(--accent)", fontSize: 14 }}>
                ₩{receivedNum.toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkMemoInput({ value, onChange }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        fontSize: 11, color: "var(--text-secondary)",
        fontWeight: 700, marginBottom: 8,
      }}>
        📝 작업 메모 (선택)
      </div>
      <textarea
        placeholder="작업 내용 / 특이사항"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", minHeight: 50, padding: 10,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-primary)",
          fontSize: 11,
          resize: "vertical",
          outline: "none", boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// ──────────────── 진행중 사진 (작업 전 / 후 박스 + 미리보기) ────────────────
function PhotoSection({ photos, beforeFileRef, afterFileRef, onPhotoChange, onRemove }) {
  const beforePhotos = photos.filter(p => p.step === "시작");
  const afterPhotos  = photos.filter(p => p.step === "완료");
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      {/* 박스 2개 — 작업 전 / 작업 후 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div onClick={() => beforeFileRef.current?.click()}
             style={{
               background: "var(--card-bg)",
               borderRadius: 8,
               border: "1px dashed #FF1B8D",
               padding: 12, minHeight: 100,
               display: "flex", flexDirection: "column",
               alignItems: "center", justifyContent: "center",
               cursor: "pointer",
             }}>
          <Camera size={28} color="#FF1B8D"/>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 6 }}>작업 전</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{beforePhotos.length}장</div>
        </div>
        <div onClick={() => afterFileRef.current?.click()}
             style={{
               background: "var(--card-bg)",
               borderRadius: 8,
               border: afterPhotos.length > 0 ? "1px dashed #FF1B8D" : "1px dashed var(--border)",
               padding: 12, minHeight: 100,
               display: "flex", flexDirection: "column",
               alignItems: "center", justifyContent: "center",
               cursor: "pointer",
             }}>
          <Camera size={28} color={afterPhotos.length > 0 ? "#FF1B8D" : "var(--text-secondary)"}/>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 6 }}>작업 후</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{afterPhotos.length}장</div>
        </div>
      </div>

      {/* 미리보기 — 작업 전 / 작업 후 */}
      <PhotoPreview label="작업 전 사진" photos={beforePhotos} allPhotos={photos} onRemove={onRemove}/>
      <PhotoPreview label="작업 후 사진" photos={afterPhotos}  allPhotos={photos} onRemove={onRemove}/>

      <input ref={beforeFileRef} type="file" accept="image/*" multiple
             onChange={(e) => onPhotoChange(e, "시작")} style={{ display: "none" }}/>
      <input ref={afterFileRef}  type="file" accept="image/*" multiple
             onChange={(e) => onPhotoChange(e, "완료")} style={{ display: "none" }}/>
    </div>
  );
}

function PhotoPreview({ label, photos, allPhotos, onRemove }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
        {label} ({photos.length})
      </div>
      {photos.length === 0 ? (
        <div style={{
          fontSize: 11, color: "var(--text-tertiary)", textAlign: "center",
          padding: 12, background: "var(--card-bg)", borderRadius: 6,
          border: "0.5px solid var(--border)",
        }}>
          아직 박지 X
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {photos.map(p => {
            const realIdx = allPhotos.findIndex(x => x.url === p.url && x.step === p.step);
            return (
              <div key={`${p.url}-${p.step}`} style={{
                aspectRatio: "1", background: "var(--surface-secondary)",
                borderRadius: 6, position: "relative", overflow: "hidden",
              }}>
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                <button onClick={(e) => { e.stopPropagation(); onRemove(realIdx); }}
                        style={{
                          position: "absolute", top: 2, right: 2,
                          background: "rgba(0,0,0,0.5)", color: "#fff",
                          width: 18, height: 18, borderRadius: "50%",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 0,
                        }}>
                  <X size={10}/>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────── 완료 사진 ────────────────
function CompletedPhotos({ task }) {
  const [photos, setPhotos] = useState({ before: [], after: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listPhotosByTask(task.id);
        if (cancelled || !res?.ok) return;
        const all = res.photos || [];
        setPhotos({
          before: all.filter(p => p.step === "시작"),
          after:  all.filter(p => p.step === "완료"),
        });
      } catch (e) {
        console.error("사진 로드 박지 X:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [task.id]);

  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        fontSize: 11, color: "var(--text-secondary)",
        fontWeight: 700, marginBottom: 8,
      }}>
        📷 작업 사진
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
      }}>
        <CompletedPhotoSlot label="작업 전" photos={photos.before}/>
        <CompletedPhotoSlot label="작업 후" photos={photos.after}/>
      </div>
    </div>
  );
}

function CompletedPhotoSlot({ label, photos = [] }) {
  if (photos.length === 0) {
    return (
      <div style={{
        aspectRatio: "4/3",
        background: "var(--bg-secondary)",
        borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>사진 미등록</span>
        <div style={{
          position: "absolute", bottom: 6, left: 6,
          fontSize: 9, color: "var(--text-secondary)",
          background: "rgba(0,0,0,0.15)",
          padding: "2px 6px", borderRadius: 10,
        }}>
          {label}
        </div>
      </div>
    );
  }
  return (
    <div
      onClick={() => window.open(photos[0].url, "_blank")}
      style={{
        aspectRatio: "4/3",
        background: "var(--bg-secondary)",
        borderRadius: 8,
        cursor: "pointer", position: "relative",
        overflow: "hidden",
      }}
    >
      <img
        src={photos[0].url}
        alt={label}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div style={{
        position: "absolute", bottom: 6, left: 6,
        fontSize: 9, color: "#fff",
        background: "rgba(0,0,0,0.5)",
        padding: "2px 6px", borderRadius: 10,
      }}>
        {label}
      </div>
      {photos.length > 1 && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          fontSize: 10, fontWeight: 700, color: "#fff",
          background: "rgba(0,0,0,0.6)",
          padding: "2px 6px", borderRadius: 6,
        }}>
          +{photos.length - 1}
        </div>
      )}
    </div>
  );
}

function CompletedMemo({ memo }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        fontSize: 11, color: "var(--text-secondary)",
        fontWeight: 700, marginBottom: 8,
      }}>
        📝 작업 메모
      </div>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6, padding: 10,
        fontSize: 11, color: "var(--text-primary)",
        lineHeight: 1.5,
      }}>
        {memo}
      </div>
    </div>
  );
}

// ──────────────── 정산 정보 (완료) ────────────────
function SettlementInfo({ task }) {
  // 2026-05-22 — DB totalAmount 우선 (visit_only 측 travel_fee 포함 / product_price=0 처리).
  //   옛 흐름 측 task.estimateTotal 측 옛 견적 측 남아있어 visit_only 작업 측 잘못된 작업 금액 표시.
  //   DB total_amount = product_price + extra_fee + travel_fee (GENERATED) — 모든 status 측 일관.
  //   fallback: 옛 산식 (estimateTotal + extraFee) — 일반 흐름 측 회귀 안전.
  const dbTotal = Number(task.totalAmount || task.total_amount || 0);
  const total = dbTotal > 0
    ? dbTotal
    : ((task.workAmount || task.estimateTotal || 0) + (task.extraFee || 0));
  const workAmount = total - (task.extraFee || 0);
  const engineerNet = task.engineer_amount || 0;
  // V14 v6 — 사장님 spec: 수수료 = 판매가 - 기사 수익 (실제 회사 송금 금액 / % 표시 X)
  const commission = Math.max(0, total - engineerNet);

  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        fontSize: 11, color: "var(--text-secondary)",
        fontWeight: 700, marginBottom: 8,
      }}>
        💰 정산 정보
      </div>
      <div style={{
        background: "var(--bg-secondary)",
        borderRadius: 8, padding: 12,
      }}>
        <SettlementRow label="작업 금액" value={`₩${workAmount.toLocaleString("ko-KR")}`}/>
        {task.extraFee > 0 && (
          <SettlementRow label="현장 추가금" value={`₩${task.extraFee.toLocaleString("ko-KR")}`}/>
        )}
        <div style={{
          borderTop: "1px solid var(--border)",
          margin: "6px 0", paddingTop: 6,
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700 }}>합계</span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "inherit", color: "var(--text-primary)" }}>
            ₩{total.toLocaleString("ko-KR")}
          </span>
        </div>
        <SettlementRow
          label="수수료"
          value={`- ₩${commission.toLocaleString("ko-KR")}`}
          valueColor="var(--text-secondary)"
        />
        <div style={{
          background: "rgba(255,27,141,0.10)",
          border: "1px solid rgba(255,27,141,0.3)",
          borderRadius: 6, padding: "8px 10px", marginTop: 8,
          display: "flex", justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "#FF1B8D", fontWeight: 700 }}>프로 수익</span>
          <span style={{ fontSize: 16, color: "#FF1B8D", fontWeight: 700, fontFamily: "inherit" }}>
            ₩{engineerNet.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>
    </div>
  );
}

function SettlementRow({ label, value, valueColor }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "3px 0",
    }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        fontSize: 11,
        color: valueColor || "var(--text-primary)",
        fontFamily: "inherit",
      }}>
        {value}
      </span>
    </div>
  );
}

// ──────────────── ⋮ 메뉴 (BottomSheet) ────────────────
function TaskMenu({ task, onClose, onReschedule, onCancel, onContactOps }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 1000,
      display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%",
        background: "var(--bg-primary)",
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: 14,
      }}>
        {task.status === "확정" && (
          <>
            <MenuItem icon="🕐" label="일정 변경" onClick={onReschedule}/>
            <MenuItem icon="⛔" label="작업 취소 / 부분 취소" danger onClick={onCancel}/>
            <MenuDivider/>
            <MenuItem icon="⚠️" label="운영팀 연락" onClick={onContactOps}/>
          </>
        )}
        {task.status === "진행중" && (
          <>
            <MenuItem icon="⛔" label="부분 취소" danger onClick={onCancel}/>
            <MenuDivider/>
            <MenuItem icon="⚠️" label="운영팀 연락" onClick={onContactOps}/>
          </>
        )}
        {(task.status === "완료" || task.status === "visit_only") && (
          <MenuItem icon="⚠️" label="운영팀 연락" onClick={onContactOps}/>
        )}
        {task.status === "미배정" && (
          <MenuItem icon="⚠️" label="운영팀 연락" onClick={onContactOps}/>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, danger, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: 12,
      background: "transparent", border: "none",
      color: danger ? "#FF3D5A" : "var(--text-primary)",
      fontSize: 12, fontWeight: 700,
      textAlign: "left", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: "inherit",
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "4px 8px" }}/>;
}

// ──────────────── 출장비만 다이얼로그 ────────────────
function VisitOnlyDialog({ task, onClose, onConfirm }) {
  const [reason, setReason] = useState(null);

  const reasons = [
    { id: "wrong_type", icon: "🔧", label: "작업 종류 다름", sub: "요청과 다른 작업" },
    { id: "no_access",  icon: "🚫", label: "진입 불가",     sub: "전기 X / 사다리 X" },
    { id: "absent",     icon: "👤", label: "고객 부재",     sub: "통화 X / 만남 X" },
    { id: "other",      icon: "💬", label: "기타",          sub: "메모 작성" },
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.6)",
      zIndex: 1000,
      display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%",
        background: "var(--bg-primary)",
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              작업 불가 처리
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
            사유 선택 / 출장비만 정산
          </div>
        </div>

        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {reasons.map(r => (
            <button
              key={r.id}
              onClick={() => setReason(r.id)}
              style={{
                padding: 12,
                background: reason === r.id ? "rgba(255,143,0,0.10)" : "var(--bg-secondary)",
                border: reason === r.id ? "1px solid #FF8F00" : "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                textAlign: "left", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
                {r.icon} {r.label}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-secondary)" }}>
                {r.sub}
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: "0 16px 14px" }}>
          <div style={{
            background: "rgba(255,27,141,0.10)",
            border: "1px solid rgba(255,27,141,0.3)",
            borderRadius: 8, padding: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>출장비</span>
              <span style={{ fontSize: 12, color: "#FF1B8D", fontWeight: 700, fontFamily: "inherit" }}>
                ₩30,000
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>프로 수익</span>
              <span style={{ fontSize: 12, color: "#FF1B8D", fontWeight: 700, fontFamily: "inherit" }}>
                ₩30,000 (100%)
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: 10,
              background: "transparent",
              border: "1px solid var(--text-secondary)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>
              뒤로
            </button>
            <button
              onClick={() => onConfirm && onConfirm(reason)}
              disabled={!reason}
              style={{
                flex: 2, padding: 10,
                background: "#FF8F00", border: "none",
                borderRadius: 8, color: "#fff",
                fontSize: 11, fontWeight: 700,
                cursor: reason ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                opacity: reason ? 1 : 0.4,
              }}
            >
              출장비만 정산
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────── CancelScreen (부분 취소) ────────────────
function CancelScreen({ task, itemEngineerAmounts = {}, onBack, onConfirm }) {
  const allItems = getTaskItems(task, itemEngineerAmounts);
  const [items, setItems] = useState(allItems.map(it => ({ ...it, checked: false })));
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");

  const checkedCount = items.filter(i => i.checked).length;
  const cancelAmount = items.filter(i => i.checked).reduce((s, i) => s + (i.price || 0), 0);
  const remainAmount = items.filter(i => !i.checked).reduce((s, i) => s + (i.price || 0), 0);

  function toggle(id) {
    setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px" }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
          fontFamily: "inherit",
        }}>
          ← 뒤로
        </button>
        <div style={{
          flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700,
          color: "var(--text-primary)",
        }}>
          ⛔ 작업 취소
        </div>
        <div style={{ width: 28 }}/>
      </div>

      <div style={{
        padding: "12px 16px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>⚠️</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>주의</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
          취소된 항목은 복구 불가
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
          고객 / 일정
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          {task.customer}님
        </div>
        {/* V14 v6 — 날짜 라인 (사장님 spec: '5월 7일 (목) · 내일') */}
        <div style={{
          fontSize: 11,
          color: workDateColor(task.scheduledDate),
          fontWeight: 700, marginTop: 4, marginBottom: 2,
        }}>
          {workDateLabel(task.scheduledDate) || "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
          {task.scheduledTime || ""} · {task.address || ""}
        </div>
      </div>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 11, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          📋 취소할 항목
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: 10,
                background: "var(--bg-secondary)",
                border: item.checked ? "1px solid #FF3D5A" : "1px solid var(--border)",
                borderRadius: 8, cursor: "pointer",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4,
                background: item.checked ? "#FF3D5A" : "transparent",
                border: item.checked ? "none" : "1.5px solid var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 700,
              }}>
                {item.checked ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                  {item.name} ×{item.qty}
                </div>
              </div>
              <div style={{
                fontSize: 12,
                fontFamily: "inherit",
                color: item.checked ? "#FF3D5A" : "var(--text-secondary)",
                fontWeight: item.checked ? 700 : 400,
              }}>
                ₩{(item.price || 0).toLocaleString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: "12px 16px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>취소될 금액</span>
          <span style={{ fontSize: 12, color: "#FF3D5A", fontWeight: 700, fontFamily: "inherit" }}>
            - ₩{cancelAmount.toLocaleString("ko-KR")}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>남는 작업 금액</span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "inherit", color: "var(--text-primary)" }}>
            ₩{remainAmount.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          fontSize: 11, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8,
        }}>
          📝 취소 사유 (필수)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {["고객 요청", "일정 충돌", "기타"].map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={{
                padding: 10,
                background: reason === r ? "rgba(255,61,90,0.10)" : "var(--bg-secondary)",
                border: reason === r ? "1px solid #FF3D5A" : "1px solid var(--border)",
                borderRadius: 6,
                color: reason === r ? "#FF3D5A" : "var(--text-primary)",
                fontSize: 11, textAlign: "left",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          placeholder="추가 메모"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          style={{
            width: "100%", minHeight: 40, padding: 8,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 11, boxSizing: "border-box",
            outline: "none", fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onBack} style={{
            flex: 1, padding: 10,
            background: "transparent",
            border: "1px solid var(--text-secondary)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}>
            뒤로
          </button>
          <button
            onClick={() => onConfirm && onConfirm({
              items: items.filter(i => i.checked),
              reason, memo,
            })}
            disabled={checkedCount === 0 || !reason}
            style={{
              flex: 2, padding: 10,
              background: "#FF3D5A", border: "none",
              borderRadius: 8, color: "#fff",
              fontSize: 11, fontWeight: 700,
              cursor: (checkedCount > 0 && reason) ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              opacity: (checkedCount > 0 && reason) ? 1 : 0.4,
            }}
          >
            {checkedCount === 0 ? "항목 선택" : `⛔ ${checkedCount}건 취소`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────── RescheduleScreen (일정 변경) ────────────────
function RescheduleScreen({ task, onBack, onConfirm }) {
  const [newDate, setNewDate] = useState(task.scheduledDate || "");
  const [newStart, setNewStart] = useState(task.scheduledTime || "");
  const [newEnd, setNewEnd] = useState(task.endTime || "");
  const [reason, setReason] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px" }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
          fontFamily: "inherit",
        }}>
          ← 뒤로
        </button>
        <div style={{
          flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700,
          color: "var(--text-primary)",
        }}>
          🕐 일정 변경
        </div>
        <div style={{ width: 28 }}/>
      </div>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
          현재 일정
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700,
          fontFamily: "inherit", color: "var(--text-primary)",
        }}>
          {task.scheduledDate || "—"} {task.scheduledTime || ""}
          {task.endTime ? ` ~ ${task.endTime}` : ""}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          {task.customer}님 · {task.address || ""}
        </div>
      </div>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
          📅 새 날짜
        </div>
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          style={{
            width: "100%", padding: 10,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13, boxSizing: "border-box",
            outline: "none", marginBottom: 12,
            fontFamily: "inherit",
          }}
        />
        <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
          🕐 새 시간
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            style={{
              flex: 1, padding: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 13, boxSizing: "border-box", outline: "none",
              fontFamily: "inherit",
            }}
          />
          <span style={{
            alignSelf: "center", fontSize: 11,
            color: "var(--text-primary)",
          }}>~</span>
          <input
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            style={{
              flex: 1, padding: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              fontSize: 13, boxSizing: "border-box", outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
          📝 변경 사유 (선택)
        </div>
        <textarea
          placeholder="고객 요청 등"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{
            width: "100%", minHeight: 50, padding: 10,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 11, boxSizing: "border-box",
            outline: "none", resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ padding: "14px 16px" }}>
        <button
          onClick={() => onConfirm && onConfirm({ newDate, newStart, newEnd, reason })}
          style={{
            width: "100%", padding: 14,
            background: "#FF1B8D", border: "none",
            borderRadius: 12, color: "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ✓ 일정 변경
        </button>
      </div>
    </div>
  );
}

export default EngineerTaskDetailScreen;
