// 2026-06-06 — 작업 기본 정보 편집 (5 필드만).
//   호출처: PrincipalApp.TaskDetail (원청 partner) / AdminTaskDetailScreen (운영자 admin).
//   RPC: update_task_basic (Mig 099) — 정산/배정 컬럼 보호.
//
// 편집 필드 (5):
//   1) 연락처   (phone, 필수)
//   2) 주소     (address, 필수)
//   3) 고객명   (customer_name, 선택)
//   4) 희망일정 (scheduled_at — KST 입력 → UTC 변환, 4 chip: 오늘/내일/일정 미정/직접 입력, 필수)
//   5) 요청사항 (request_note, 선택)
//
// props:
//   task           — 현재 task 객체 (id/phone/address/customer/scheduled_at/request_note 등)
//   actorUserId    — 현재 로그인 user UUID (currentUser.user_id, 'A004' 같은 code 아님)
//   accentColor    — 핑크 (t.accent 권장)
//   t              — 테마
//   onClose()      — 닫기 (저장 안 함)
//   onSaved(task)  — 저장 성공 → 상세 재조회 트리거

import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import {
  updateTaskBasic, describeTaskBasicError,
  kstYmdHmToUtcIso, utcIsoToKstDateTime,
} from "../lib/taskBasicEditRpc.js";

// KST 오늘/내일 YYYY-MM-DD
function ymdKst(daysOffset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + daysOffset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

// 초기 schedule mode 추측 (task.scheduled_at → 오늘/내일/input/null)
function inferScheduleMode(scheduledAt) {
  if (!scheduledAt) return null;
  const { date } = utcIsoToKstDateTime(scheduledAt);
  if (!date) return null;
  if (date === ymdKst(0)) return "today";
  if (date === ymdKst(1)) return "tomorrow";
  return "input";
}

// 2026-07-07 — Section / Chip 을 모듈 스코프로 hoist (안티패턴 fix).
//   과거: 함수 본문 안에서 정의 → 매 렌더 재정의 → identity 불안정 → input DOM
//   unmount/remount → 매 keystroke 마다 포커스 소실. 원본 (2026-06-06 생성) 부터
//   존재한 버그. 모듈 스코프로 옮겨 identity 고정 → input DOM 안정.
//   t / accentColor 는 프롭으로 전달.
function Section({ icon, label, required, error, children, t, accentColor }) {
  const borderColor = error ? t.danger : (required ? accentColor : t.border);
  const borderWidth = (error || required) ? 2 : 1;
  return (
    <div style={{
      marginBottom: 12,
      background: t.bgElevated,
      border: `${borderWidth}px solid ${borderColor}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{label}</span>
        {error && <span style={{ marginLeft: "auto", fontSize: 10, color: t.danger, fontWeight: 700 }}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, t, accentColor }) {
  return (
    <button onClick={onClick} type="button" style={{
      padding: "6px 12px",
      background: active ? accentColor : t.bgInset,
      border: active ? `1px solid ${accentColor}` : `1px solid ${t.border}`,
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: active ? "white" : t.textSecondary,
      cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</button>
  );
}

export function TaskBasicEditScreen({ task, actorUserId, accentColor = "#FF1B8D", t, onClose, onSaved }) {
  // 초기값 task 측 추출
  const initKst = utcIsoToKstDateTime(task?.scheduledAt || task?.scheduled_at);

  const [form, setForm] = useState({
    phone:        task?.phone || "",
    address:      task?.address || "",
    customerName: task?.customer || task?.customer_name || "",
    requestDate:  initKst.date,
    requestTime:  initKst.time,
    requestNote:  task?.requestNote || task?.request_note || task?.memo || "",
  });
  const [scheduleMode, setScheduleMode] = useState(() => inferScheduleMode(task?.scheduledAt || task?.scheduled_at));
  const [errors, setErrors]             = useState({});
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState("");

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  }

  // 일정 chip 핸들러
  function setScheduleToday() {
    setScheduleMode("today");
    setForm(prev => ({ ...prev, requestDate: ymdKst(0), requestTime: "" }));
    if (errors.schedule) setErrors(prev => ({ ...prev, schedule: null }));
  }
  function setScheduleTomorrow() {
    setScheduleMode("tomorrow");
    setForm(prev => ({ ...prev, requestDate: ymdKst(1), requestTime: "" }));
    if (errors.schedule) setErrors(prev => ({ ...prev, schedule: null }));
  }
  function setScheduleTbd() {
    setScheduleMode("tbd");
    setForm(prev => ({ ...prev, requestDate: "", requestTime: "" }));
    if (errors.schedule) setErrors(prev => ({ ...prev, schedule: null }));
  }
  function setScheduleInput() {
    setScheduleMode("input");
    if (errors.schedule) setErrors(prev => ({ ...prev, schedule: null }));
  }

  // 연락처 자동 하이픈 (010-1234-5678 + 0503-1234-56789 안심번호).
  // 2026-07-04 — 안심번호 13자리 지원. 하드캡 11→13, 4-4-5 분기 추가.
  //   shared receptionForm.formatPhone 과 동일 로직 (통합은 별도 사이클).
  function formatPhone(raw) {
    const d = String(raw || "").replace(/\D/g, "").slice(0, 13);
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 13) return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8)}`;
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    return d;
  }

  async function handleSubmit() {
    const errs = {};
    if (!form.phone.trim())   errs.phone    = "연락처 입력";
    if (!form.address.trim()) errs.address  = "주소 입력";
    if (scheduleMode == null) errs.schedule = "희망 일정 선택";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // 일정 → ISO 변환
    let scheduledIso = null;
    if (scheduleMode === "today" || scheduleMode === "tomorrow" || scheduleMode === "input") {
      if (form.requestDate) scheduledIso = kstYmdHmToUtcIso(form.requestDate, form.requestTime);
    }
    // tbd → null

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await updateTaskBasic({
        taskId:       task.id,
        phone:        formatPhone(form.phone),
        address:      form.address.trim(),
        customerName: form.customerName.trim(),
        scheduledAt:  scheduledIso,
        requestNote:  form.requestNote.trim(),
        actor:        actorUserId,
      });
      if (!res || res.ok !== true) {
        setSubmitError(describeTaskBasicError(res?.error));
        setSubmitting(false);
        return;
      }
      // 성공 — parent 상세 재조회
      onSaved?.();
    } catch (e) {
      setSubmitError(e?.message || "저장 실패");
      setSubmitting(false);
    }
  }

  const inputStyle = (hasError) => ({
    width: "100%", padding: "12px 14px",
    background: t.bgInset,
    border: `1px solid ${hasError ? t.danger : t.border}`,
    borderRadius: 8, fontSize: 14, color: t.text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  });

  // 2026-07-07 — Section / Chip 은 모듈 스코프로 이동 (파일 상단). 매 렌더 재정의로
  //   input DOM 이 unmount/remount 돼 포커스 소실되던 안티패턴 fix. t/accentColor 는 프롭.

  return (
    <div className="fade-in" style={{ background: t.bg, minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{
        padding: "16px",
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, background: t.bg, zIndex: 100,
      }}>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text, display: "flex",
        }}><ArrowLeft size={18}/></button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>작업 정보 수정</div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
            {task?.taskNo || task?.task_no} · {task?.customer || task?.customer_name || ""}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <Section icon="📞" label="연락처" required error={errors.phone} t={t} accentColor={accentColor}>
          <input type="tel" value={form.phone}
            onChange={(e) => update("phone", formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            style={inputStyle(!!errors.phone)}/>
        </Section>

        <Section icon="📍" label="주소" required error={errors.address} t={t} accentColor={accentColor}>
          <input type="text" value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="강남구 역삼동 123-45"
            style={inputStyle(!!errors.address)}/>
        </Section>

        <Section icon="👤" label="고객명" t={t} accentColor={accentColor}>
          <input type="text" value={form.customerName}
            onChange={(e) => update("customerName", e.target.value)}
            placeholder="고객명 (선택)"
            style={inputStyle(false)}/>
        </Section>

        <Section icon="📅" label="희망 일정 (필수)" required error={errors.schedule} t={t} accentColor={accentColor}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip active={scheduleMode === "today"}    onClick={setScheduleToday}    t={t} accentColor={accentColor}>오늘</Chip>
            <Chip active={scheduleMode === "tomorrow"} onClick={setScheduleTomorrow} t={t} accentColor={accentColor}>내일</Chip>
            <Chip active={scheduleMode === "tbd"}      onClick={setScheduleTbd}      t={t} accentColor={accentColor}>일정 미정</Chip>
            <Chip active={scheduleMode === "input"}    onClick={setScheduleInput}    t={t} accentColor={accentColor}>직접 입력</Chip>
          </div>
          {scheduleMode === "today" && (
            <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
              오늘 ({form.requestDate}) — 시간 미지정
            </div>
          )}
          {scheduleMode === "tomorrow" && (
            <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
              내일 ({form.requestDate}) — 시간 미지정
            </div>
          )}
          {scheduleMode === "tbd" && (
            <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
              일정 미정 — 추후 협의
            </div>
          )}
          {scheduleMode === "input" && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input type="date" value={form.requestDate}
                onChange={(e) => update("requestDate", e.target.value)}
                style={{ ...inputStyle(false), flex: 1 }}/>
              <input type="time" value={form.requestTime}
                onChange={(e) => update("requestTime", e.target.value)}
                style={{ ...inputStyle(false), flex: 1 }}/>
            </div>
          )}
        </Section>

        <Section icon="📝" label="요청사항" t={t} accentColor={accentColor}>
          <textarea value={form.requestNote}
            onChange={(e) => update("requestNote", e.target.value)}
            placeholder="추가 요청사항"
            rows={3}
            style={{ ...inputStyle(false), resize: "vertical", lineHeight: 1.5 }}/>
        </Section>

        {submitError && (
          <div style={{
            marginTop: 8, marginBottom: 12, padding: "10px 12px",
            background: `${t.danger}1A`, border: `1px solid ${t.danger}`,
            borderRadius: 8, fontSize: 11, color: t.danger, fontWeight: 600,
          }}>⚠️ {submitError}</div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={onClose} disabled={submitting} style={{
            flex: 1, padding: 14,
            background: "transparent",
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            color: t.textSecondary,
            fontSize: 13, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}>취소</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, padding: 14,
            background: submitting ? t.bgInset : accentColor,
            color: submitting ? t.textMuted : "#fff",
            border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 800,
            cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Save size={16}/>
            <span>{submitting ? "저장 중..." : "저장"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskBasicEditScreen;
