// Step 11 — 작업 상세 수정 화면
// 권한별 필드 활성/비활성 + 변경 분량 비교 + 이력 자동 기록
//
// 2026-06-25 — 누설/설치 활성화 동기화:
//   · WORKTYPE_OPTIONS 4종 통일 (세척/냉매충전/누설/설치). 옛 "철거"/"이전설치" workType
//     데이터는 0건 확인됨 — 신규 모델에선 workType="설치" + appliance="철거"/"이전설치" 등.
//   · 기종 풀은 getAppliancePool 로 동적 분기 (workType 별 5종/7종 다름).
import { useState, useMemo } from "react";
import { canEditField } from "../data/permissions.js";
import { saveTaskHistory, getFieldLabel } from "../data/taskHistory.js";
import { getAppliancePool, formatWorkTypeLabel } from "../utils/receptionForm.js";
// 2026-07-14 — 사장님 리포트 "수정해도 내용이 다르게 있어": 이 화면의 저장이
//   localStorage 이력 + 토스트만 남기고 DB 에 아무것도 안 쓰던 유령이었음.
//   fix: 안전 매핑 필드(고객명/연락처/주소/견적/비고)만 updateTaskAdapter 로 실제 저장.
//   작업내용(task_items 연동 필요)·일정(전용 흐름)·금액분배(정산 엔진 소관)는
//   이 화면에서 수정 잠금 — 가짜 저장보다 정직한 잠금.
import { updateTaskAdapter } from "../data/tasksDb.js";

const WORKTYPE_OPTIONS = ["세척", "냉매충전", "누설", "설치"];

export function TaskEditScreen({ task, user, onBack, onSave }) {
  const original = useMemo(() => ({ ...task }), [task]);
  const [data, setData] = useState({ ...task });

  if (!task) return null;

  function set(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }

  function diffChanges() {
    const changes = [];
    const fields = new Set([...Object.keys(original), ...Object.keys(data)]);
    fields.forEach(key => {
      const a = original[key];
      const b = data[key];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        changes.push({ field: key, before: a, after: b });
      }
    });
    return changes;
  }

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const changes = diffChanges();
    if (changes.length === 0) {
      onBack?.();
      return;
    }

    // 2026-07-14 — DB 저장 (안전 매핑 필드만). taskToRow 매핑:
    //   customer→customer_name / phone→phone / address→address /
    //   estimateTotal→productPrice(견적=product_price) / note→memo→request_note
    const DB_FIELDS = new Set(["customer", "phone", "address", "estimateTotal", "note", "memo"]);
    const dbChanges = changes.filter(c => DB_FIELDS.has(c.field));
    if (dbChanges.length > 0) {
      setSaving(true);
      const updates = {};
      for (const c of dbChanges) {
        if (c.field === "estimateTotal") updates.productPrice = Number(data.estimateTotal) || 0;
        else if (c.field === "note" || c.field === "memo") updates.memo = data.note || data.memo || "";
        else updates[c.field] = data[c.field];
      }
      const res = await updateTaskAdapter(task.id, updates);
      setSaving(false);
      if (!res || res.ok === false) {
        alert(`저장 실패 — ${res?.error || "알 수 없는 오류"}\n변경이 저장되지 않았습니다.`);
        return;   // 화면 유지 — 재시도 가능
      }
    }

    changes.forEach(c => {
      saveTaskHistory({
        taskId: task.id,
        userId: user?.userId || user?.id || "",
        userName: user?.displayName || user?.name || "—",
        userRole: user?.role || "—",
        action: "edit",
        field: c.field,
        before: c.before,
        after: c.after,
      });
    });
    onSave?.(data, changes);
    onBack?.();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Pretendard', sans-serif",
    }}>
      <Header title="작업 수정" subtitle={task.taskCode || task.id} onBack={onBack} onAction={handleSave} saving={saving}/>

      <div style={{ padding: 16 }}>
        <ReadOnlyField label="작업번호" value={task.taskCode || task.id}/>

        <Section title="📋 고객 정보">
          <FieldText
            label="고객명"
            value={data.customer || ""}
            onChange={v => set("customer", v)}
            editable={canEditField(user, "customerName")}
          />
          <FieldText
            label="연락처"
            value={data.phone || ""}
            onChange={v => set("phone", v)}
            editable={canEditField(user, "customerPhone")}
            placeholder="010-1234-5678"
          />
          <FieldText
            label="주소"
            value={data.address || ""}
            onChange={v => set("address", v)}
            editable={canEditField(user, "address")}
          />
        </Section>

        {/* 2026-07-14 — 작업 내용은 이 화면에서 수정 잠금.
              workItems 는 task_items 테이블과 이중 저장 구조 (정산 엔진이 task_items 사용)
              — 여기서 category_data 만 고치면 정산이 어긋남. 표시만 하고 잠금. */}
        <Section title="🛠️ 작업 내용 (읽기 전용)">
          {Array.isArray(data.workItems) && data.workItems.length > 0 ? (
            <WorkItemsEditor
              items={data.workItems}
              onChange={() => {}}
              editable={false}
            />
          ) : (
            <>
              <FieldSelect
                label="작업 종류"
                value={data.workType || ""}
                options={WORKTYPE_OPTIONS}
                onChange={() => {}}
                editable={false}
              />
              <FieldSelect
                label={data.workType === "설치" ? "종류" : "기종"}
                value={data.appliance || ""}
                options={getAppliancePool(data.workType, data.principal)}
                onChange={() => {}}
                editable={false}
              />
              <FieldNumber
                label="수량"
                value={data.qty || 1}
                onChange={() => {}}
                editable={false}
                min={1}
              />
            </>
          )}
          <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
            작업 종류·기종 변경은 정산과 연결되어 있어 여기서 수정할 수 없습니다. 운영팀 흐름(재접수/항목 조정)을 이용해주세요.
          </div>
        </Section>

        {/* 2026-07-14 — 일정 잠금: schedule/time 은 화면 표시용 파생 문자열이라
              여기서 고쳐도 실제 일정(scheduled_at)이 안 바뀜. 일정 변경은 타임라인/기사 앱 흐름. */}
        <Section title="📅 일정 (읽기 전용)">
          <FieldText
            label="일정"
            value={data.schedule || ""}
            onChange={() => {}}
            editable={false}
          />
          <FieldText
            label="시간"
            value={data.time || ""}
            onChange={() => {}}
            editable={false}
          />
          <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 6 }}>
            일정 변경은 작업 상세의 '일정 변경' 또는 타임라인에서 해주세요.
          </div>
        </Section>

        {(canEditField(user, "estimateTotal") || canEditField(user, "addonFee")
          || canEditField(user, "engineer_amount") || canEditField(user, "principal_amount")) && (
          <Section title="💰 금액">
            {canEditField(user, "estimateTotal") && (
              <FieldNumber
                label="견적 금액"
                value={data.estimateTotal || 0}
                onChange={v => set("estimateTotal", v)}
                editable
                suffix="원"
              />
            )}
            {/* 2026-07-14 — 분배 금액(원청/프로/마진)·추가금은 정산 엔진(compute_payment)
                  소관이라 여기서 고쳐도 반영 안 됨 (기존에도 유령 필드) — 표시만. */}
            {canEditField(user, "principal_amount") && (
              <FieldNumber
                label="원청 수수료 (자동 계산)"
                value={data.principal_amount || 0}
                onChange={() => {}}
                editable={false}
                suffix="원"
              />
            )}
            {canEditField(user, "engineer_amount") && (
              <FieldNumber
                label="프로 단가 (자동 계산)"
                value={data.engineer_amount || 0}
                onChange={() => {}}
                editable={false}
                suffix="원"
              />
            )}
          </Section>
        )}

        {(canEditField(user, "note") || canEditField(user, "memo")) && (
          <Section title="📝 비고">
            {canEditField(user, "note") && (
              <FieldTextarea
                label="비고"
                value={data.note || ""}
                onChange={v => set("note", v)}
                placeholder="기타 메모..."
              />
            )}
            {canEditField(user, "memo") && data.memo !== undefined && (
              <FieldTextarea
                label="메모"
                value={data.memo || ""}
                onChange={v => set("memo", v)}
                placeholder="현장 메모..."
              />
            )}
          </Section>
        )}

        <div style={{
          marginTop: 14, padding: "10px 12px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8, fontSize: 11, color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}>
          ℹ️ 고객명·연락처·주소·견적 금액·비고가 저장 대상입니다. 저장 시 DB에 반영되고 수정 이력에 기록됩니다.
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle, onBack, onAction, saving = false }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 10,
      background: "var(--bg-primary)",
      borderBottom: "1px solid var(--border)",
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <button onClick={onBack} style={{
        background: "transparent", border: "none",
        color: "var(--text-primary)", fontSize: 20,
        cursor: "pointer", padding: 4, fontFamily: "inherit",
      }}>←</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {subtitle && (
          <div className="mono" style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <button onClick={onAction} disabled={saving} style={{
        background: saving ? "var(--bg-tertiary)" : "var(--accent)",
        color: saving ? "var(--text-tertiary)" : "#fff", border: "none",
        padding: "8px 14px", borderRadius: 8,
        fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
      }}>{saving ? "저장 중..." : "저장"}</button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: "var(--text-secondary)",
        marginBottom: 8,
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function FieldShell({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const readonlyStyle = {
  ...inputStyle,
  opacity: 0.55,
  background: "var(--bg-inset, var(--bg-secondary))",
  cursor: "not-allowed",
};

function FieldText({ label, value, onChange, editable = true, placeholder = "" }) {
  if (!editable) {
    return (
      <FieldShell label={label}>
        <div style={readonlyStyle}>{value || "—"}</div>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={label}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </FieldShell>
  );
}

function FieldNumber({ label, value, onChange, editable = true, min, suffix }) {
  if (!editable) {
    return (
      <FieldShell label={label}>
        <div style={readonlyStyle}>{(value || 0).toLocaleString("ko-KR")}{suffix ? ` ${suffix}` : ""}</div>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          min={min}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          style={inputStyle}
        />
        {suffix && (
          <span style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>{suffix}</span>
        )}
      </div>
    </FieldShell>
  );
}

function FieldSelect({ label, value, options, onChange, editable = true }) {
  if (!editable) {
    return (
      <FieldShell label={label}>
        <div style={readonlyStyle}>{value || "—"}</div>
      </FieldShell>
    );
  }
  return (
    <FieldShell label={label}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">선택</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </FieldShell>
  );
}

function FieldTextarea({ label, value, onChange, placeholder = "" }) {
  return (
    <FieldShell label={label}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
      />
    </FieldShell>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div className="mono" style={readonlyStyle}>{value || "—"}</div>
    </div>
  );
}

function WorkItemsEditor({ items, onChange, editable }) {
  function update(idx, key, value) {
    const next = items.map((it, i) => i === idx ? { ...it, [key]: value } : it);
    onChange(next);
  }
  function bumpQty(idx, delta) {
    update(idx, "qty", Math.max(1, (items[idx].qty || 1) + delta));
  }
  function addItem() {
    onChange([...items, { workType: "세척", appliance: "벽걸이", qty: 1 }]);
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, idx) => (
        <div key={idx} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}>
          {editable ? (
            <>
              <select
                value={it.workType || ""}
                onChange={e => update(idx, "workType", e.target.value)}
                style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}
              >
                {WORKTYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{formatWorkTypeLabel(opt)}</option>)}
              </select>
              {it.workType !== "냉매충전" && (
                <select
                  value={it.appliance || ""}
                  onChange={e => update(idx, "appliance", e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}
                >
                  <option value="">— {it.workType === "설치" ? "종류" : "기종"} —</option>
                  {getAppliancePool(it.workType, null).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              <button onClick={() => bumpQty(idx, -1)} style={qtyBtnStyle}>−</button>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, minWidth: 22, textAlign: "center" }}>
                {it.qty || 1}
              </span>
              <button onClick={() => bumpQty(idx, 1)} style={qtyBtnStyle}>+</button>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>대</span>
              <button onClick={() => removeItem(idx)} style={removeBtnStyle}>×</button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
              {it.workType} {it.appliance && `· ${it.appliance}`} ×{it.qty || 1}
            </span>
          )}
        </div>
      ))}
      {editable && (
        <button onClick={addItem} style={{
          padding: "8px 12px",
          background: "transparent",
          border: "1px dashed var(--border)",
          color: "var(--accent)",
          fontSize: 12, fontWeight: 600,
          borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
        }}>+ 작업 항목 추가</button>
      )}
    </div>
  );
}

const qtyBtnStyle = {
  width: 28, height: 28,
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  fontSize: 14, fontWeight: 700,
  borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const removeBtnStyle = {
  width: 24, height: 24,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  fontSize: 12, fontWeight: 600,
  borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
  marginLeft: 4,
};

export default TaskEditScreen;
