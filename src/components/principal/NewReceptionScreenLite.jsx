// 유솔 포털 — 새 접수 등록 (경량판)
// 2026-05-24
// 운영자 PWA NewReceptionFormScreen의 검증된 로직을 복사 — usol_h 측 catch 측 catch.
// 제거: 원청 dropdown / 카톡 빠른 입력 / feePreview / KA 1way split / auto assign.
// 유지: 이름 자동 생성 / workItems 여러 개 / 견적 미정 토글 / 일정 미정·입력.
//
// 저장 spec:
//   createTaskAdapter({ principalCode: "usol_h", workItems, ... })
//   → tasks INSERT (category_data.workItems 포함)
//   → trigger sync_category_data_to_task_items (Mig 017)으로 task_items 자동 생성
//   → 작업 상세 ItemProgress 측 측 측 측 catch.
import { useState } from "react";
import { ArrowLeft, Send, Plus, X } from "lucide-react";
import { createTaskAdapter as createTask } from "../../data/tasksDb.js";

// 유솔H spec — 작업 종류 / 기종 풀
const WORK_TYPES = ["세척", "냉매충전", "출장비"];
const APPLIANCE_POOL = {
  "세척":     ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
  "냉매충전": ["벽걸이", "스탠드", "4way", "투인원", "1way"],
  "출장비":   ["(공통)"],
};
const CHANNEL_FIXED = "직접";

// 이름 자동 생성 — 운영자 PWA NewReceptionFormScreen 측 catch 측 그대로
function autoGenerateCustomer(form, region) {
  if (form.customer && form.customer.trim()) return form.customer.trim();
  const digits = (form.phone || "").replace(/\D/g, "");
  const last4  = digits.length >= 4 ? digits.slice(-4) : "";
  let regionShort = "";
  const src = region || form.address || "";
  if (src) {
    const m = src.match(/([가-힣]+?)(?:구|시|동|군)/);
    if (m) regionShort = m[1];
    else regionShort = src.split(/\s+/)[0];
  }
  if (regionShort && last4) return `${regionShort}${last4}`;
  if (regionShort)          return `${regionShort}고객`;
  if (last4)                return `고객${last4}`;
  return "고객 미정";
}

export function NewReceptionScreenLite({ t, onBack, onSubmit }) {
  const [form, setForm] = useState({
    customer: "", phone: "", address: "",
    requestDate: "", requestTime: "", memo: "",
    estimateTotal: 0,
  });
  const [errors, setErrors] = useState({});
  const [workItems, setWorkItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState({ workType: "", appliance: "", qty: 1 });
  const [scheduleMode, setScheduleMode] = useState(null);   // null | "tbd" | "input"
  const [priceTBD, setPriceTBD] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  }

  // 지역 — 주소 첫 단어
  const region = (() => {
    const parts = (form.address || "").trim().split(/\s+/);
    return parts[0] || "";
  })();

  function addWorkItem() {
    if (!editItem.workType || !editItem.appliance) return;
    setWorkItems(prev => [...prev, { ...editItem }]);
    setEditItem({ workType: "", appliance: "", qty: 1 });
    setShowAddItem(false);
    if (errors.workItems) setErrors(prev => ({ ...prev, workItems: null }));
  }
  function removeWorkItem(idx) {
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    const errs = {};
    if (!form.phone.trim()) errs.phone = "연락처 입력";
    if (!form.address.trim()) errs.address = "주소 입력";
    if (workItems.length === 0) errs.workItems = "작업 항목 1개 이상";
    if (!priceTBD && (!form.estimateTotal || form.estimateTotal <= 0)) errs.estimateTotal = "견적 입력";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const finalCustomer = autoGenerateCustomer(form, region);
    const scheduleType  = scheduleMode === "input" ? "specific" : "tbd";
    const head = workItems[0] || {};

    setSubmitting(true);
    setSubmitError("");
    try {
      const taskData = {
        principalCode: "usol_h",
        channel:       CHANNEL_FIXED,
        customer:      finalCustomer,
        phone:         form.phone,
        address:       form.address,
        region,
        workType:      head.workType,
        appliance:     head.appliance,
        qty:           head.qty || 1,
        workItems,
        quote:         priceTBD ? 0 : form.estimateTotal,
        estimateTotal: priceTBD ? 0 : form.estimateTotal,
        scheduledDate: scheduleMode === "input" ? form.requestDate : null,
        scheduledTime: scheduleMode === "input" ? form.requestTime : null,
        memo:          form.memo,
        status:        "미배정",
        scheduleType,
      };
      const res = await createTask(taskData);
      if (!res.ok) {
        setSubmitError(res.error || "등록 실패");
        setSubmitting(false);
        return;
      }
      onSubmit?.({
        id: res.taskId, taskNo: res.task_no,
        customer: finalCustomer, phone: form.phone, address: form.address,
        workItems, region,
      });
    } catch (e) {
      setSubmitError(e.message || "등록 실패");
      setSubmitting(false);
    }
  }

  const inputStyle = (hasError) => ({
    width: "100%", padding: "10px 12px",
    background: t.bgInset,
    border: `1px solid ${hasError ? t.danger : t.border}`,
    borderRadius: 8, fontSize: 13, color: t.text,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  });

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{
        padding: "16px",
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, background: t.bg, zIndex: 100,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text, display: "flex",
        }}><ArrowLeft size={18}/></button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>새 접수 등록</div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
            유솔홈케어 H · 직접 입력
          </div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* 연락처 */}
        <FormSection t={t} icon="📞" label="연락처" required error={errors.phone}>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="010-0000-0000"
            style={inputStyle(!!errors.phone)}
          />
        </FormSection>

        {/* 주소 */}
        <FormSection t={t} icon="📍" label="주소" required error={errors.address}>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="강남구 역삼동 123-45"
            style={inputStyle(!!errors.address)}
          />
        </FormSection>

        {/* 고객명 (자동 생성, 직접 입력 측 X) */}
        <FormSection t={t} icon="👤" label="고객명 (선택)">
          <input
            type="text"
            value={form.customer}
            onChange={(e) => update("customer", e.target.value)}
            placeholder={`자동: ${autoGenerateCustomer(form, region)}`}
            style={inputStyle(false)}
          />
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>
            비워두면 지역 + 전화번호 끝 4자리로 자동 생성됩니다.
          </div>
        </FormSection>

        {/* 작업 항목 */}
        <FormSection t={t} icon="🔧" label="작업 항목" required error={errors.workItems}>
          {workItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {workItems.map((it, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px",
                  background: t.bgInset, border: `1px solid ${t.border}`,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12, color: t.text }}>
                    {it.workType} · {it.appliance} · {it.qty}대
                  </span>
                  <button onClick={() => removeWorkItem(idx)} style={{
                    background: "transparent", border: "none", color: t.textMuted, cursor: "pointer",
                    padding: 0, display: "flex",
                  }}><X size={14}/></button>
                </div>
              ))}
            </div>
          )}

          {!showAddItem ? (
            <button onClick={() => setShowAddItem(true)} style={{
              width: "100%", padding: "10px 12px",
              background: "transparent",
              border: `1px dashed ${t.border}`, borderRadius: 8,
              color: t.textSecondary, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><Plus size={14}/> 작업 항목 추가</button>
          ) : (
            <div style={{
              padding: 10, background: t.bgInset, borderRadius: 8,
              border: `1px solid ${t.border}`,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>작업 종류</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {WORK_TYPES.map(wt => (
                    <FormChip key={wt} t={t} active={editItem.workType === wt}
                      onClick={() => setEditItem(prev => ({ ...prev, workType: wt, appliance: "" }))}
                    >{wt}</FormChip>
                  ))}
                </div>
              </div>
              {editItem.workType && (
                <div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>기종</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(APPLIANCE_POOL[editItem.workType] || []).map(ap => (
                      <FormChip key={ap} t={t} active={editItem.appliance === ap}
                        onClick={() => setEditItem(prev => ({ ...prev, appliance: ap }))}
                      >{ap}</FormChip>
                    ))}
                  </div>
                </div>
              )}
              {editItem.appliance && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>수량</span>
                  <input
                    type="number" min="1" value={editItem.qty}
                    onChange={(e) => setEditItem(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                    style={{ ...inputStyle(false), width: 80 }}
                  />
                  <span style={{ fontSize: 11, color: t.textMuted }}>대</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  onClick={addWorkItem}
                  disabled={!editItem.workType || !editItem.appliance}
                  style={{
                    flex: 1, padding: "8px 12px",
                    background: (editItem.workType && editItem.appliance) ? "#FF4D9E" : t.bgInset,
                    color: (editItem.workType && editItem.appliance) ? "#fff" : t.textMuted,
                    border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                    cursor: (editItem.workType && editItem.appliance) ? "pointer" : "not-allowed",
                  }}
                >추가</button>
                <button onClick={() => { setShowAddItem(false); setEditItem({ workType: "", appliance: "", qty: 1 }); }}
                  style={{
                    padding: "8px 12px",
                    background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8,
                    color: t.textSecondary, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >취소</button>
              </div>
            </div>
          )}
        </FormSection>

        {/* 견적 */}
        <FormSection t={t} icon="💰" label="견적 금액" required error={errors.estimateTotal}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <FormChip t={t} active={!priceTBD} onClick={() => setPriceTBD(false)}>직접 입력</FormChip>
            <FormChip t={t} active={priceTBD} onClick={() => { setPriceTBD(true); update("estimateTotal", 0); }}>견적 미정</FormChip>
          </div>
          {!priceTBD && (
            <input
              type="number" min="0"
              value={form.estimateTotal || ""}
              onChange={(e) => update("estimateTotal", parseInt(e.target.value) || 0)}
              placeholder="200000"
              style={inputStyle(!!errors.estimateTotal)}
            />
          )}
          {priceTBD && (
            <div style={{ fontSize: 11, color: t.warning, fontWeight: 600 }}>
              ⚠️ 현장에서 금액 확정 — 작업 완료 후 추가금 입력
            </div>
          )}
        </FormSection>

        {/* 일정 */}
        <FormSection t={t} icon="📅" label="희망 일정">
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <FormChip t={t} active={scheduleMode === "input"} onClick={() => setScheduleMode("input")}>직접 입력</FormChip>
            <FormChip t={t} active={scheduleMode === "tbd"} onClick={() => setScheduleMode("tbd")}>일정 미정</FormChip>
          </div>
          {scheduleMode === "input" && (
            <div style={{ display: "flex", gap: 6 }}>
              <input type="date" value={form.requestDate}
                onChange={(e) => update("requestDate", e.target.value)}
                style={{ ...inputStyle(false), flex: 1 }}
              />
              <input type="time" value={form.requestTime}
                onChange={(e) => update("requestTime", e.target.value)}
                style={{ ...inputStyle(false), flex: 1 }}
              />
            </div>
          )}
        </FormSection>

        {/* 요청사항 */}
        <FormSection t={t} icon="📝" label="요청사항 (선택)">
          <textarea
            value={form.memo}
            onChange={(e) => update("memo", e.target.value)}
            placeholder="추가 요청사항"
            rows={3}
            style={{ ...inputStyle(false), resize: "vertical", lineHeight: 1.5 }}
          />
        </FormSection>

        {submitError && (
          <div style={{
            marginTop: 8, marginBottom: 12, padding: "10px 12px",
            background: `${t.danger}1A`, border: `1px solid ${t.danger}`,
            borderRadius: 8, fontSize: 11, color: t.danger, fontWeight: 600,
          }}>⚠️ {submitError}</div>
        )}

        <button onClick={handleSubmit} disabled={submitting} style={{
          width: "100%", padding: 14, marginTop: 8,
          background: submitting ? t.bgInset : "#FF4D9E",
          color: submitting ? t.textMuted : "#fff",
          border: "none", borderRadius: 10,
          fontSize: 14, fontWeight: 800,
          cursor: submitting ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Send size={16}/>
          <span>{submitting ? "저장 중..." : "접수 등록하기"}</span>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Helpers — AdminApp NewReceptionFormScreen 측 측 그대로 (의존성 X 측 위해 같이 정의)
// ════════════════════════════════════════════════════════════
function FormSection({ t, icon, label, required, error, children }) {
  return (
    <div style={{
      marginBottom: 12,
      background: t.bgElevated,
      border: `1px solid ${error ? t.danger : t.border}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: "#FF4D9E", fontWeight: 800 }}>*</span>}
        {error && <span style={{ marginLeft: "auto", fontSize: 10, color: t.danger, fontWeight: 700 }}>{error}</span>}
      </div>
      {children}
    </div>
  );
}

function FormChip({ t, active, onClick, children }) {
  return (
    <button onClick={onClick} type="button" style={{
      padding: "6px 12px",
      background: active ? "#FF4D9E" : t.bgInset,
      border: active ? `1px solid #FF4D9E` : `1px solid ${t.border}`,
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: active ? "white" : t.textSecondary,
      cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</button>
  );
}

export default NewReceptionScreenLite;
