// V13-FINAL — 기사 PWA 작업 상세 (3 상태 + 부분 취소 + 일정 변경 + 출장비만)
// V14 — 사진 분류 X / 완료 분기 3가지 (완료 / 부분 / 출장비만)
// 진입: 오늘 화면 / 새 배정 리스트 / 다음 일정
// 상태: "약속대기" / "확정" / "진행중" / "완료" / "visit_only" / "취소"
// 한 화면 흐름 (별도 완료보고 화면 X)

import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";
import {
  TaskCompleteScreen as CompletionCompleteScreen,
  TaskPartialScreen,
  TaskVisitOnlyScreen,
} from "./EngineerTaskCompletionScreens.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { workDateLabel, workDateColor } from "../utils/dateLabel.js";
import { useIsDark } from "../hooks/useIsDark.js";
import { WorkItemRow } from "./WorkItemRow.jsx";

// ──────────────── helpers ────────────────
function getCurrentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function calcTotalDuration(task) {
  if (!task.startedAt || !task.completedAt) return "—";
  const [sh, sm] = String(task.startedAt).split(":").map(n => parseInt(n, 10) || 0);
  const [eh, em] = String(task.completedAt).split(":").map(n => parseInt(n, 10) || 0);
  const diff = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  if (diff < 60) return `${diff}분`;
  return `${Math.floor(diff / 60)}시간 ${diff % 60}분`;
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

// V14 v6 — 시/구/도로명 합치기 (T맵/네이버 정확 catch)
function buildFullAddress(task) {
  const region = task.region || task.address || ""; // 강남구 청담동
  const detail = task.fullAddress || "";            // 청담로 200, 101동 502호
  if (!region && !detail) return "";
  if (!region) return detail;
  if (!detail) return region;
  // 시 prefix 자동 (서울특별시 / 경기도) — 시 박혀있지 X 면 region 그대로
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
  // V14 v6 — T맵 앱 시도 → 1.5초 후 웹 fallback
  const appUrl = `tmap://route?goalname=${addr}&goaladdr=${addr}`;
  const webUrl = `https://tmap.life/?q=${addr}`;
  const start = Date.now();
  window.location.href = appUrl;
  setTimeout(() => {
    if (Date.now() - start < 2000 && document.visibilityState === "visible") {
      window.open(webUrl, "_blank");
    }
  }, 1500);
}

// 작업 항목 정규화 (INITIAL_TASKS는 단일 workType/appliance만 — items 배열로 변환)
function getTaskItems(task) {
  if (Array.isArray(task.items) && task.items.length > 0) return task.items;
  if (!task.workType) return [];
  return [{
    id: `${task.id}-1`,
    name: task.workType,
    qty: task.qty || 1,
    price: task.estimateTotal || 0,
    serviceType: task,
  }];
}

// ──────────────── 메인 컴포넌트 ────────────────
export function EngineerTaskDetailScreen({ task, onBack, onUpdate }) {
  // V14 — 사진 = 단일 array (분류 X / 최소 2장)
  const initialPhotos = (() => {
    if (Array.isArray(task.photos)) return task.photos.map(p => typeof p === "string" ? p : p?.url || "✓");
    const old = [];
    if (task.photoBefore || task.beforePhoto) old.push("✓");
    if (task.photoAfter  || task.afterPhoto)  old.push("✓");
    return old;
  })();
  const [photos, setPhotos] = useState(initialPhotos);
  const [extraFee, setExtraFee] = useState(task.extraFee ? String(task.extraFee) : "");
  const [workMemo, setWorkMemo] = useState(task.workMemo || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [visitOnlyOpen, setVisitOnlyOpen] = useState(false);
  const [subScreen, setSubScreen] = useState(null); // null / "cancel" / "reschedule"
  const fileInputRef = useRef(null);
  const PHOTO_MIN = 2;

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
        task={{ ...task, extraFee: parseInt(extraFee || "0", 10) }}
        photos={photos}
        onBack={() => setSubScreen(null)}
        onConfirm={(payload) => {
          onUpdate && onUpdate(task.id, {
            status: "완료",
            completedAt: getCurrentTime(),
            photos: photos.map(p => ({ url: p })),
            extraFee: parseInt(extraFee || "0", 10),
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
        task={{ ...task, extraFee: parseInt(extraFee || "0", 10) }}
        photos={photos}
        onBack={() => setSubScreen(null)}
        onConfirm={(payload) => {
          onUpdate && onUpdate(task.id, {
            status: "완료",
            completedAt: getCurrentTime(),
            partialReason: payload.reasonId,
            partialMemo: payload.memo,
            actualQty: payload.actualQty,
            photos: photos.map(p => ({ url: p })),
            extraFee: parseInt(extraFee || "0", 10),
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
        onConfirm={(payload) => {
          onUpdate && onUpdate(task.id, {
            status: "visit_only",
            visitOnlyReason: payload.reasonId,
            visitOnlyMemo: payload.memo,
            completedAt: getCurrentTime(),
            extraFee: payload.fee,
            photos: photos.map(p => ({ url: p })),
          });
          setSubScreen(null);
          onBack && onBack();
        }}
      />
    );
  }

  const isConfirmed = task.status === "확정";
  const isInProgress = task.status === "진행중";
  const isCompleted = task.status === "완료" || task.status === "visit_only";
  const isWaiting = task.status === "약속대기";

  // ──────────── 액션 핸들러 ────────────
  function handleStartTask() {
    onUpdate && onUpdate(task.id, {
      status: "진행중",
      startedAt: getCurrentTime(),
    });
  }

  function handleTakePhoto() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const next = files.map(file => {
      try { return URL.createObjectURL(file); } catch { return "✓"; }
    });
    setPhotos(prev => [...prev, ...next]);
    e.target.value = "";
  }

  function handleRemovePhoto(idx) {
    setPhotos(prev => {
      const next = [...prev];
      try { if (next[idx] && next[idx].startsWith("blob:")) URL.revokeObjectURL(next[idx]); } catch {}
      next.splice(idx, 1);
      return next;
    });
  }

  function handleCompleteReport() {
    if (photos.length < PHOTO_MIN) {
      alert(`사진은 최소 ${PHOTO_MIN}장 필요합니다.`);
      return;
    }
    onUpdate && onUpdate(task.id, {
      status: "완료",
      completedAt: getCurrentTime(),
      photos: photos.map(p => ({ url: p })),
      photoBefore: true,
      photoAfter: true,
      beforePhoto: true,
      afterPhoto: true,
      extraFee: parseInt(extraFee || "0", 10),
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

  function handleReschedule({ newDate, newStart, newEnd, reason }) {
    onUpdate && onUpdate(task.id, {
      scheduledDate: newDate,
      scheduledTime: newStart,
      endTime: newEnd,
      rescheduleReason: reason,
      rescheduledAt: getCurrentTime(),
    });
  }

  function handleCancel({ items, reason, memo }) {
    const allItems = getTaskItems(task);
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
          {task.id || "—"}
        </div>
        <button onClick={() => setMenuOpen(true)} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 16,
          cursor: "pointer",
        }}>
          ⋮
        </button>
      </div>

      {/* V14 — 확정/진행중 = 통합 메인 카드 (시간 + 작업 항목 + 고객) */}
      {(isConfirmed || isInProgress) && <WorkMainCard task={task}/>}
      {isCompleted && <StatusBlockCompleted task={task}/>}
      {isWaiting && <StatusBlockWaiting task={task}/>}

      {/* 완료/대기 — 작업 항목 별도 (확정/진행중은 WorkMainCard 안에 통합됨) */}
      {(isCompleted || isWaiting) && <TaskItemsList task={task}/>}

      {/* 영역 3 — 요청사항 + 운영 메모 + 전화/문자 (확정/진행중은 고객 헤더 숨김) */}
      <CustomerInfo task={task} hideCustomerHeader={isConfirmed || isInProgress}/>

      {/* V14 — 길찾기 (확정만 / 네이버 + T맵) */}
      {isConfirmed && <MapButtons task={task}/>}

      {/* 진행중 — 사진 / 추가금 / 메모 */}
      {isInProgress && (
        <>
          <PhotoGrid
            photos={photos}
            minRequired={PHOTO_MIN}
            onAdd={handleTakePhoto}
            onRemove={handleRemovePhoto}
          />
          <input
            ref={fileInputRef}
            type="file" accept="image/*" capture="environment" multiple
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
          <ExtraFeeInput value={extraFee} onChange={setExtraFee} onAdd={addExtra}/>
          <WorkMemoInput value={workMemo} onChange={setWorkMemo}/>
        </>
      )}

      {/* 완료 — 박힌 사진 + 메모 + 정산 */}
      {isCompleted && (
        <>
          <CompletedPhotos task={task}/>
          {task.workMemo && <CompletedMemo memo={task.workMemo}/>}
          <SettlementInfo task={task}/>
        </>
      )}

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
      {isConfirmed && (
        <div style={{ padding: "16px" }}>
          <button
            onClick={handleStartTask}
            style={{
              width: "100%", padding: 19,
              background: "#FF1B8D", border: "none",
              borderRadius: 16, color: "#fff",
              fontSize: 18, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ▶ 작업 시작
          </button>
          <div style={{
            marginTop: 10, textAlign: "center",
            fontSize: 12, color: "#888", fontWeight: 600,
          }}>
            현장 도착 후 시작
          </div>
        </div>
      )}

      {isInProgress && (() => {
        const enough = photos.length >= PHOTO_MIN;
        return (
        <div style={{ padding: "14px 16px 22px" }}>
          {/* V14 — 메인 액션 (작업 완료 / 핑크 풀 V14 메인 액션) */}
          <button
            onClick={() => {
              if (!enough) {
                alert(`사진은 최소 ${PHOTO_MIN}장 필요합니다.`);
                return;
              }
              setSubScreen("complete");
            }}
            disabled={!enough}
            style={{
              width: "100%", padding: 18,
              background: enough ? "#FF1B8D" : "var(--bg-tertiary)",
              border: "none", borderRadius: 16,
              color: enough ? "#fff" : "var(--text-tertiary)",
              fontSize: 17, fontWeight: 600,
              cursor: enough ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              marginBottom: 10,
            }}
          >
            {enough ? "✓ 작업 완료" : `✓ 작업 완료 (사진 ${PHOTO_MIN}장 필요)`}
          </button>

          {/* V14 헌법 — 부분 완료 = 회색 (중립) / 출장비만 = 빨강 (취소) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={() => setSubScreen("partial")}
              style={{
                padding: 13,
                background: "transparent",
                border: "1.5px solid #C8C8C8",
                borderRadius: 12,
                color: "#555",
                fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#888" }}/>
              부분 완료
            </button>
            <button
              onClick={() => setSubScreen("visitOnly")}
              style={{
                padding: 13,
                background: "transparent",
                border: "1.5px solid #FF3B5C",
                borderRadius: 12,
                color: "var(--cancel-text)",
                fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
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

      {/* ⋮ 메뉴 (BottomSheet) */}
      {menuOpen && (
        <TaskMenu
          task={task}
          onClose={() => setMenuOpen(false)}
          onReschedule={() => { setMenuOpen(false); setSubScreen("reschedule"); }}
          onCancel={() => { setMenuOpen(false); setSubScreen("cancel"); }}
          onContactOps={() => { setMenuOpen(false); alert("운영팀 연락"); }}
        />
      )}

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
function WorkMainCard({ task }) {
  const colors = getWorkTypeColors(task.workType);
  const isDark = useIsDark();
  const labelColor = isDark ? colors.label.dark : colors.label.light;
  const isInProgress = task.status === "진행중";

  // 진행률 계산
  const pct = (() => {
    if (!task.startedAt || !task.endTime) return 0;
    const toMin = (s) => {
      const [h, m] = String(s).split(":");
      return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
    };
    const startMin = toMin(task.startedAt);
    const endMin   = toMin(task.endTime);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (endMin <= startMin) return 0;
    return Math.max(0, Math.min(100, ((nowMin - startMin) / (endMin - startMin)) * 100));
  })();

  const items = getTaskItems(task);
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

      {/* 영역 1 — 상태 + 시간 + (진행중인 경우 시작 시각 우측) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: labelColor,
        }}/>
        <span style={{ fontSize: 14, color: labelColor, fontWeight: 700 }}>
          {isInProgress ? "진행중" : "확정"}
        </span>
        {isInProgress && task.startedAt && (
          <span style={{
            marginLeft: "auto",
            fontSize: 13, color: "var(--label-main)", fontWeight: 700,
          }}>
            {task.startedAt} 시작
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
          {(isInProgress ? task.startedAt : task.scheduledTime) || task.time || "—"}
        </span>
        {task.endTime && (
          <span style={{ fontSize: 18, color: "#888", fontWeight: 700 }}>
            ~ {task.endTime}
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
          <span style={{ fontSize: 14 }}>📅</span> 예정 시각 {task.scheduledTime || task.time || "—"}
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
                dividerTop={idx > 0}
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
        <div style={{
          fontSize: 14, color: "var(--label-main)",
          fontWeight: 700,
        }}>
          📍 {task.fullAddress || task.address || "—"}
        </div>
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
      const [h, m] = String(s).split(":");
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
            {task.startedAt} 시작
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
        <div style={{
          fontSize: 36, fontWeight: 600, fontFamily: "inherit",
          color: "var(--text-primary)", letterSpacing: "-1px",
        }}>
          {task.startedAt || task.scheduledTime || "—"}
        </div>
        {task.endTime && (
          <div style={{ fontSize: 16, color: "#888", fontWeight: 600 }}>
            ~ {task.endTime}
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <div style={{
          fontSize: 28, fontWeight: 700, fontFamily: "inherit",
          color: "var(--text-primary)",
        }}>
          {task.startedAt || "—"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          ~ {task.completedAt || "—"}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        총 {calcTotalDuration(task)} 작업
      </div>
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
function TaskItemsList({ task }) {
  const items = getTaskItems(task);
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
            dividerTop={idx > 0}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────── 고객 + 요청사항 + 운영팀 메모 ────────────────
function CustomerInfo({ task, hideCustomerHeader = false }) {
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
          <div style={{
            fontSize: 14, color: "var(--text-secondary)",
            fontWeight: 600, marginBottom: 12,
          }}>
            📍 {task.fullAddress || task.address || "—"}
          </div>
        </>
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

      {/* V14 — 전화 (초록) / 문자 (보더) */}
      {!isCompleted && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={() => makeCall(task.phone)} style={{
            padding: 13,
            background: "#34C759",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            📞 전화
          </button>
          <button onClick={() => sendSms(task.phone)} style={{
            padding: 13,
            background: "var(--card-bg)",
            border: "1.5px solid var(--input-border)",
            borderRadius: 10,
            color: "var(--text-secondary)",
            fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            💬 문자
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────── 이동 정보 (확정만) ────────────────
// V14 v6 — 길찾기 두 버튼 (네이버 그린 / T맵 파랑) + 앱 URL scheme
function MapButtons({ task }) {
  function openNaver() { openMap(task); }
  function openTmapBtn() { openTmap(task); }
  return (
    <div style={{ padding: "0 16px 14px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
      }}>
        <button onClick={openNaver} style={{
          padding: 13,
          background: "var(--card-bg)",
          border: "1.5px solid #03C75A",
          borderRadius: 10,
          color: "#03C75A",
          fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 4,
            background: "#03C75A", color: "#fff",
            fontSize: 11, fontWeight: 600,
          }}>N</span>
          네이버 지도
        </button>
        <button onClick={openTmapBtn} style={{
          padding: 13,
          background: "var(--card-bg)",
          border: "1.5px solid #1F8AFF",
          borderRadius: 10,
          color: "#1F8AFF",
          fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 4,
            background: "#1F8AFF", color: "#fff",
            fontSize: 11, fontWeight: 600,
          }}>T</span>
          T맵
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
function ExtraFeeInput({ value, onChange, onAdd }) {
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

// ──────────────── 완료 사진 ────────────────
function CompletedPhotos({ task }) {
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
        <CompletedPhotoSlot label="작업 전"/>
        <CompletedPhotoSlot label="작업 후"/>
      </div>
    </div>
  );
}

function CompletedPhotoSlot({ label }) {
  return (
    <div
      onClick={() => alert("사진 크게 보기")}
      style={{
        aspectRatio: "4/3",
        background: "var(--bg-secondary)",
        borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", position: "relative",
      }}
    >
      <div style={{ fontSize: 22, color: "#00875A" }}>✓</div>
      <div style={{
        position: "absolute", bottom: 6, left: 6,
        fontSize: 9, color: "#fff",
        background: "rgba(0,0,0,0.5)",
        padding: "2px 6px", borderRadius: 10,
      }}>
        {label}
      </div>
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
  const workAmount = task.workAmount || task.estimateTotal || 0;
  const total = workAmount + (task.extraFee || 0);
  const engineerNet = task.engineerNet || 0;
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
          <span style={{ fontSize: 11, color: "#FF1B8D", fontWeight: 700 }}>기사 수익</span>
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
        {task.status === "약속대기" && (
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
              <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>기사 수익</span>
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
function CancelScreen({ task, onBack, onConfirm }) {
  const allItems = getTaskItems(task);
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
