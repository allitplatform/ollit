// Step 11 — 작업 상세 수정 화면
// 권한별 필드 활성/비활성 + 변경 분량 비교 + 이력 자동 기록
import { useState, useMemo } from "react";
import { canEditField } from "../data/permissions.js";
import { saveTaskHistory, getFieldLabel } from "../data/taskHistory.js";

const APPLIANCE_OPTIONS = ["벽걸이", "스탠드", "투인원", "1way", "4way", "원형", "천장형"];
const WORKTYPE_OPTIONS  = ["세척", "냉매충전", "철거", "설치", "이전설치"];

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

  function handleSave() {
    const changes = diffChanges();
    if (changes.length === 0) {
      onBack?.();
      return;
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
      <Header title="작업 수정" subtitle={task.taskCode || task.id} onBack={onBack} onAction={handleSave}/>

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

        <Section title="🛠️ 작업 내용">
          {Array.isArray(data.workItems) && data.workItems.length > 0 ? (
            <WorkItemsEditor
              items={data.workItems}
              onChange={items => set("workItems", items)}
              editable={canEditField(user, "workItems")}
            />
          ) : (
            <>
              <FieldSelect
                label="작업 종류"
                value={data.workType || ""}
                options={WORKTYPE_OPTIONS}
                onChange={v => set("workType", v)}
                editable={canEditField(user, "workType")}
              />
              <FieldSelect
                label="기종"
                value={data.appliance || ""}
                options={APPLIANCE_OPTIONS}
                onChange={v => set("appliance", v)}
                editable={canEditField(user, "appliances")}
              />
              <FieldNumber
                label="수량"
                value={data.qty || 1}
                onChange={v => set("qty", v)}
                editable={canEditField(user, "appliances")}
                min={1}
              />
            </>
          )}
        </Section>

        <Section title="📅 일정">
          <FieldText
            label="일정"
            value={data.schedule || ""}
            onChange={v => set("schedule", v)}
            editable={canEditField(user, "schedule")}
            placeholder="예: 오늘 오후 2시"
          />
          <FieldText
            label="시간"
            value={data.time || ""}
            onChange={v => set("time", v)}
            editable={canEditField(user, "time")}
            placeholder="14:00"
          />
        </Section>

        {(canEditField(user, "estimateTotal") || canEditField(user, "addonFee")
          || canEditField(user, "engineerEarning") || canEditField(user, "principalFee")) && (
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
            {canEditField(user, "addonFee") && (
              <FieldNumber
                label="현장 추가금"
                value={data.addonFee || 0}
                onChange={v => set("addonFee", v)}
                editable
                suffix="원"
              />
            )}
            {canEditField(user, "principalFee") && (
              <FieldNumber
                label="원청 수수료"
                value={data.principalFee || 0}
                onChange={v => set("principalFee", v)}
                editable
                suffix="원"
              />
            )}
            {canEditField(user, "engineerEarning") && (
              <FieldNumber
                label="기사 단가"
                value={data.engineerEarning || 0}
                onChange={v => set("engineerEarning", v)}
                editable
                suffix="원"
              />
            )}
            {canEditField(user, "companyMargin") && (
              <FieldNumber
                label="회사 마진"
                value={data.companyMargin || 0}
                onChange={v => set("companyMargin", v)}
                editable
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
          ℹ️ 변경된 항목은 자동으로 수정 이력에 기록됩니다.
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle, onBack, onAction }) {
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
      <button onClick={onAction} style={{
        background: "var(--accent)",
        color: "#fff", border: "none",
        padding: "8px 14px", borderRadius: 8,
        fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>저장</button>
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
                {WORKTYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {it.workType !== "냉매충전" && (
                <select
                  value={it.appliance || ""}
                  onChange={e => update(idx, "appliance", e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}
                >
                  {APPLIANCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
