// Step 6 — 기사 편집/추가 화면
// 사장님 catch: 직급/상태/작업종류별 역할/지역/기종 직접 컨트롤
// Step 5-2 — 시트 설정_기사 양방향 sync (saveEngineerWithSync / deleteEngineerWithSync)
// Step 5-4 — 시트 설정_기사단가 양방향 sync (saveEngineerRateWithSync / deleteEngineerRateWithSync)
// Step 5-5-C Phase 4-B-2 — 새 역량 폼 코드 완전 제거 (옛 workTypes 폼만 / Phase 4-C 양방향 박을 예정)
import { useState, useMemo } from "react";
import {
  saveEngineerWithSync, deleteEngineerWithSync,
  saveEngineerRateWithSync, deleteEngineerRateWithSync,
  loadEngineerRatesByEngineer,
  mapSheetSkillToWorkType,
  saveEngineerSkillWithSync, deleteEngineerSkillWithSync,
  CAREER_LEVELS, STATUS_OPTIONS, ROLE_OPTIONS, APPLIANCE_OPTIONS,
  SEOUL_DISTRICTS, GG_INCHEON,
} from "../data/engineers.js";
// 2026-05-28 — 신규 기사 code 자동 부여 (next_engineer_code RPC).
//   옛: generateId(name) = `${name}_${Date.now().toString(36)}` → "이름_랜덤" 비정상 code.
//   새: Supabase RPC 가 max(E0xx)+1 반환 → 'E035' 형식 보장. RPC 실패 시 fallback X (사장님 spec).
import { supabase } from "../lib/supabase.js";

// Step 5-5-C Phase 4-C-2 — 시트 (전체) 행 매핑 헬퍼 (form 초기값 + workTypesOriginal 둘 다 호출)
function _computeInitialWorkTypes(engineer) {
  const baseCleaning    = engineer.workTypes?.cleaning    || { role: "none", zones: [], appliances: [] };
  const baseRefrigerant = engineer.workTypes?.refrigerant || { role: "none", zones: [], appliances: [] };
  const skills = Array.isArray(engineer.skills) ? engineer.skills : [];
  const isAllPrincipal = sp => sp === "(전체)" || sp === "전체";
  const cleaningSkill    = skills.find(s => isAllPrincipal(s.principal) && s.workType === "세척");
  const refrigerantSkill = skills.find(s => isAllPrincipal(s.principal) && s.workType === "냉매충전");
  return {
    cleaning:    cleaningSkill    ? mapSheetSkillToWorkType(cleaningSkill)    : { ...baseCleaning },
    refrigerant: refrigerantSkill ? mapSheetSkillToWorkType(refrigerantSkill) : { ...baseRefrigerant },
  };
}

// role ↔ grade reverse 매핑
function _roleToGrade(role) {
  if (role === "main") return "메인";
  if (role === "sub")  return "백업";
  return "";  // none은 별도 처리 (delete)
}

// workTypes 변경 detect
function _sameWorkType(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if ((a.role || "none") !== (b.role || "none")) return false;
  const az = (a.zones || []).slice().sort().join(",");
  const bz = (b.zones || []).slice().sort().join(",");
  if (az !== bz) return false;
  const aa = (a.appliances || []).slice().sort().join(",");
  const ba = (b.appliances || []).slice().sort().join(",");
  if (aa !== ba) return false;
  return true;
}
function _diffWorkTypes(original, current) {
  return {
    cleaningChanged:    !_sameWorkType(original?.cleaning,    current?.cleaning),
    refrigerantChanged: !_sameWorkType(original?.refrigerant, current?.refrigerant),
  };
}

// Step 5-2 — 냉매충전 기사 비율 옵션
const REFRIGERANT_RATE_OPTIONS = [
  { value: 50,  label: "50% (일반 / 기본)" },
  { value: 60,  label: "60% (A 그룹)" },
  { value: 100, label: "100% (대표 / 잔여 전액)" },
];

// Step 5-4 — 단가 행 옵션
const RATE_WORK_TYPES = ["세척", "냉매충전", "냉매점검", "출장비", "추가선택"];
const RATE_APPLIANCES = ["벽걸이", "스탠드", "1way", "4way", "원형", "투인원", "시스템멀티", "천장형"];

export function EngineerEditScreen({ engineer, isNew, onSaved, onBack }) {
  // Step 5-5-C Phase 4-C-3 — engineer.skills (시트 _기사역량 캐시)에서 (전체) 원청 행 우선
  // Phase 4-C-2 — _computeInitialWorkTypes 헬퍼로 form 초기값 + workTypesOriginal 둘 다 동일 매핑
  const [form, setForm] = useState(() => ({
    email: "",
    cm_refrigerant_rate: 50,
    ...engineer,
    workTypes: _computeInitialWorkTypes(engineer),
  }));
  // Step 5-5-C Phase 4-C-2 — workTypes 변경 detect용 (저장 시 form.workTypes vs Original 비교)
  const [workTypesOriginal] = useState(() => _computeInitialWorkTypes(engineer));
  const [error, setError]     = useState("");
  const [toast, setToast]     = useState(null);  // { type: 'success'|'warn'|'error', message }
  const [busy, setBusy]       = useState(false);

  // Step 5-4 — 단가 행 state (기존 행 fetch + 변경 추적)
  const [rates, setRates] = useState(() =>
    !isNew && engineer.id ? loadEngineerRatesByEngineer(engineer.id) : []
  );
  // 옛 단가 — 저장 시 비교 (삭제된 행 catch). isNew면 빈 배열
  const [ratesOriginal] = useState(() =>
    !isNew && engineer.id ? loadEngineerRatesByEngineer(engineer.id) : []
  );

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateWork(type, field, value) {
    setForm(prev => ({
      ...prev,
      workTypes: {
        ...prev.workTypes,
        [type]: { ...prev.workTypes[type], [field]: value },
      },
    }));
  }

  function toggleArrayItem(arr, item) {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  // Step 5-4 — 단가 행 핸들러
  function addRateRow() {
    setRates(prev => [...prev, { workType: "세척", applianceType: "벽걸이", rate: 0, note: "" }]);
  }
  function updateRateRow(idx, field, value) {
    setRates(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }
  function removeRateRow(idx) {
    setRates(prev => prev.filter((_, i) => i !== idx));
  }

  // 단가 행 비교 (저장 시 변경/추가/삭제 분류)
  function _rateKey(r) { return `${r.workType}|${r.applianceType}`; }
  function _diffRates(original, current) {
    const origMap = new Map(original.map(r => [_rateKey(r), r]));
    const curMap  = new Map(current.map(r => [_rateKey(r), r]));
    const upserts = [];
    const deletes = [];
    for (const [k, r] of curMap) {
      const prev = origMap.get(k);
      if (!prev || prev.rate !== r.rate || prev.note !== r.note) {
        upserts.push(r);
      }
    }
    for (const [k, r] of origMap) {
      if (!curMap.has(k)) deletes.push(r);
    }
    return { upserts, deletes };
  }


  async function handleSave() {
    setError("");
    setToast(null);
    const name = (form.name || "").trim();
    if (!name) {
      setError("이름을 입력해주세요");
      return;
    }
    let saved = { ...form, name };
    if (isNew && !saved.id) {
      // 2026-05-28 — generateId("이름_랜덤") 폐기 → Supabase RPC 자동 부여.
      //   실패 시 fallback X — 비정상 code 재발 차단 (사장님 spec).
      const { data: nextCode, error: rpcErr } = await supabase.rpc("next_engineer_code");
      if (rpcErr || !nextCode) {
        setError(`기사 번호 부여 실패: ${rpcErr?.message || "응답 없음"}`);
        return;
      }
      saved.id = nextCode;
    }
    setBusy(true);
    const res = await saveEngineerWithSync(saved);
    if (!res.ok) {
      setBusy(false);
      setToast({
        type: "warn",
        message: `로컬 저장 완료 / 시트 sync 실패: ${res.error || "알 수 없는 오류"} (저장 다시 누르면 재시도)`,
      });
      return;
    }
    // GAS가 새 ID 부여한 경우 saved.id 갱신
    if (res.engineerId && res.engineerId !== saved.id) {
      saved = { ...saved, id: res.engineerId };
    }

    // Step 5-4 — 단가 행 sync (개별 호출 / batch X)
    const validRates = rates.filter(r =>
      r.workType && r.applianceType && Number(r.rate) > 0
    );
    const rateDiff = _diffRates(ratesOriginal, validRates);
    let rateOk = 0, rateFail = 0;
    for (const r of rateDiff.upserts) {
      const rRes = await saveEngineerRateWithSync({
        engineerId: saved.id,
        workType: r.workType,
        applianceType: r.applianceType,
        rate: Number(r.rate) || 0,
        note: r.note || "",
      });
      if (rRes.ok) rateOk += 1; else rateFail += 1;
    }
    for (const r of rateDiff.deletes) {
      const rRes = await deleteEngineerRateWithSync({
        engineerId: saved.id,
        workType: r.workType,
        applianceType: r.applianceType,
      });
      if (rRes.ok) rateOk += 1; else rateFail += 1;
    }

    // Step 5-5-C Phase 4-C-2 — 옛 폼 → 시트 (전체) 행 양방향 sync
    // 2026-05-21 — 변경 검사 제거 (사장님 spec):
    //   _diffWorkTypes 측 변경 측 측 측 측 X / 측 측 측 측 측 측 측 측 측
    //   → cleaning + refrigerant 측 측 측 syncSkill 호출 → epp/ez 측 측 측 측
    // role="none" → deleteEngineerSkillWithSync / 그 외 → saveEngineerSkillWithSync
    let skillOk = 0, skillFail = 0;

    async function syncSkill(workTypeKr, wt) {
      if (!wt || wt.role === "none") {
        const sRes = await deleteEngineerSkillWithSync({
          engineerId: saved.id,
          principal:  "(전체)",
          workType:   workTypeKr,
        });
        return sRes.ok;
      }
      const sRes = await saveEngineerSkillWithSync({
        engineerId: saved.id,
        principal:  "(전체)",
        workType:   workTypeKr,
        zones:      (wt.zones || []).join(", "),
        grade:      _roleToGrade(wt.role),
        appliances: (wt.appliances || []).join(", "),
      });
      return sRes.ok;
    }

    // 2026-05-21 — 측 측 호출 (변경 측 측 측 측 X)
    if (await syncSkill("세척", form.workTypes.cleaning)) skillOk += 1;
    else skillFail += 1;
    if (await syncSkill("냉매충전", form.workTypes.refrigerant)) skillOk += 1;
    else skillFail += 1;

    setBusy(false);

    // 통합 토스트 (Step 5-4 패턴 + 역량)
    const rateOps  = rateOk  + rateFail;
    const skillOps = skillOk + skillFail;
    const parts = ["프로 저장 완료"];
    if (rateOps > 0) {
      parts.push(rateFail === 0
        ? `단가 ${rateOk}건 sync 완료`
        : `단가 sync 일부 실패 (${rateOk}/${rateOps})`);
    }
    if (skillOps > 0) {
      parts.push(skillFail === 0
        ? `역량 ${skillOk}건 sync 완료`
        : `역량 sync 일부 실패 (${skillOk}/${skillOps})`);
    }
    const anyFail = rateFail > 0 || skillFail > 0;
    setToast({
      type: anyFail ? "warn" : "success",
      message: parts.join(" / "),
    });
    setTimeout(() => onSaved && onSaved(saved), 600);
  }

  async function handleDelete() {
    if (isNew) return;
    const ok = window.confirm(`${form.name} 프로를 삭제할까요?\n\n복구 불가합니다.`);
    if (!ok) return;
    setError("");
    setToast(null);
    setBusy(true);
    const res = await deleteEngineerWithSync(form.id);
    setBusy(false);
    if (res.ok) {
      setToast({ type: "success", message: "프로 삭제 완료" });
      setTimeout(() => onSaved && onSaved(null), 600);
    } else {
      setToast({
        type: "warn",
        message: `로컬 삭제 완료 / 시트 sync 실패: ${res.error || "알 수 없는 오류"}`,
      });
    }
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>

      {/* 헤더 */}
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>{isNew ? "프로 추가" : "프로 편집"}</div>
        {!isNew && (
          <button onClick={handleDelete} style={deleteBtnStyle}>삭제</button>
        )}
      </div>

      <div style={{ padding: "16px" }}>
        {/* 기본 정보 */}
        <Section label="기본 정보">
          <Field label="이름">
            <input
              type="text" placeholder="예: 김동효"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="전화번호">
            <input
              type="text" placeholder="예: 010-9238-0412"
              value={form.phone || ""}
              onChange={(e) => updateField("phone", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="이메일 (선택)">
            <input
              type="email" placeholder="예: kim@example.com"
              value={form.email || ""}
              onChange={(e) => updateField("email", e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        {/* 냉매충전 기사 비율 (Step 5-2 / Step 3) */}
        <Section label="냉매충전 기사 비율">
          <RadioRow
            options={REFRIGERANT_RATE_OPTIONS.map(o => ({ key: o.value, label: o.label }))}
            value={form.cm_refrigerant_rate ?? 50}
            onChange={(v) => updateField("cm_refrigerant_rate", v)}
          />
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
            * 냉매충전 시 적용되는 기사 비율. 시트 설정_기사 cm_냉매비율과 양방향 sync.
          </div>
        </Section>

        {/* 직급 */}
        <Section label="직급">
          <RadioRow
            options={Object.entries(CAREER_LEVELS).map(([k, v]) => ({ key: k, label: v.name, color: v.color }))}
            value={form.careerLevel}
            onChange={(v) => updateField("careerLevel", v)}
          />
        </Section>

        {/* 상태 */}
        <Section label="상태">
          <RadioRow
            options={Object.entries(STATUS_OPTIONS).map(([k, v]) => ({ key: k, label: v.name, color: v.color }))}
            value={form.status}
            onChange={(v) => updateField("status", v)}
          />
        </Section>

        {/* 작업 종류 (옛 workTypes 폼 — 그대로 유지) */}
        <Section label="🧽 세척">
          <WorkTypeEditor
            work={form.workTypes.cleaning}
            onChange={(field, value) => updateWork("cleaning", field, value)}
            onToggleZone={(z) => updateWork("cleaning", "zones", toggleArrayItem(form.workTypes.cleaning.zones, z))}
            onToggleAppliance={(a) => updateWork("cleaning", "appliances", toggleArrayItem(form.workTypes.cleaning.appliances, a))}
          />
        </Section>

        <Section label="냉매충전">
          <WorkTypeEditor
            work={form.workTypes.refrigerant}
            onChange={(field, value) => updateWork("refrigerant", field, value)}
            onToggleZone={(z) => updateWork("refrigerant", "zones", toggleArrayItem(form.workTypes.refrigerant.zones, z))}
            onToggleAppliance={(a) => updateWork("refrigerant", "appliances", toggleArrayItem(form.workTypes.refrigerant.appliances, a))}
          />
        </Section>

        {/* Step 5-4 — 기사단가 (선택) */}
        <Section label="기사단가 (선택)">
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 10, lineHeight: 1.5 }}>
            * 비워두면 공통 단가 적용. 박힌 행은 우선 적용됨 (시트 설정_기사단가와 양방향 sync).
          </div>
          {rates.map((r, idx) => (
            <div key={idx} style={{
              display: "flex", flexDirection: "column", gap: 6,
              padding: "10px 12px", marginBottom: 8,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)", borderRadius: 8,
            }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select value={r.workType || ""} onChange={(e) => updateRateRow(idx, "workType", e.target.value)} style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}>
                  {RATE_WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <select value={r.applianceType || ""} onChange={(e) => updateRateRow(idx, "applianceType", e.target.value)} style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}>
                  {RATE_APPLIANCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={() => removeRateRow(idx)} style={{
                  background: "transparent", border: "1px solid var(--border)",
                  color: "#FF3D5A", fontSize: 11, padding: "6px 10px",
                  borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                }}>삭제</button>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="number" placeholder="단가" value={r.rate || ""}
                  onChange={(e) => updateRateRow(idx, "rate", parseInt(e.target.value, 10) || 0)}
                  style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}/>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>원</span>
                <input type="text" placeholder="비고 (선택)" value={r.note || ""}
                  onChange={(e) => updateRateRow(idx, "note", e.target.value)}
                  style={{ ...inputStyle, flex: 2, padding: "6px 8px", fontSize: 12, fontFamily: "inherit" }}/>
              </div>
            </div>
          ))}
          <button onClick={addRateRow} style={{
            width: "100%", padding: 10,
            background: "transparent", border: "1px dashed var(--border)",
            borderRadius: 8, color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>+ 단가 행 추가</button>
        </Section>

        {/* Phase 3-6-add — 계좌 정보 (관리자 직접 입력 가능) */}
        {/* 기사 본인은 EngineerApp 내정보 탭 측 EngineerAccountEditScreen에서도 변경 가능 */}
        <Section label="계좌 정보 (선택)">
          <Field label="은행">
            <input
              type="text" placeholder="예: 카카오뱅크 / KB국민은행 / 토스뱅크"
              value={form.bankName || ""}
              onChange={(e) => updateField("bankName", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="계좌번호">
            <input
              type="text" placeholder="000-000-000000"
              value={form.accountNumber || ""}
              onChange={(e) => updateField("accountNumber", e.target.value.replace(/[^0-9-]/g, ""))}
              style={inputStyle}
            />
          </Field>
          <Field label="예금주">
            <input
              type="text" placeholder="기사 본인 이름"
              value={form.accountHolder || ""}
              onChange={(e) => updateField("accountHolder", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
            * 정산 시 사용. 기사 본인이 내정보 탭에서도 변경 가능합니다.
          </div>
        </Section>

        {/* 메모 */}
        <Section label="메모 (선택)">
          <textarea
            placeholder="예: 신입 / 벽걸이만 가능"
            value={form.note || ""}
            onChange={(e) => updateField("note", e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </Section>

        {error && (
          <div style={{
            margin: "12px 0", padding: "10px 12px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            borderRadius: 8, color: "#FF3D5A",
            fontSize: 12, textAlign: "center",
          }}>{error}</div>
        )}

        {/* Step 5-2 — 토스트 (성공 / 시트 sync 실패) */}
        {toast && (
          <div style={{
            margin: "12px 0", padding: "10px 12px",
            background: toast.type === "success"
              ? "rgba(0, 135, 90, 0.10)"
              : toast.type === "warn"
              ? "rgba(245, 158, 11, 0.10)"
              : "rgba(239, 68, 68, 0.10)",
            border: `1px solid ${
              toast.type === "success" ? "rgba(0, 135, 90, 0.30)"
              : toast.type === "warn"  ? "rgba(245, 158, 11, 0.40)"
              :                          "rgba(239, 68, 68, 0.30)"
            }`,
            borderRadius: 8,
            color: toast.type === "success" ? "#00875A"
              : toast.type === "warn"       ? "#B45309"
              :                               "#FF3D5A",
            fontSize: 12, lineHeight: 1.5, textAlign: "center",
          }}>{toast.message}</div>
        )}

        {/* 저장 버튼 */}
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button onClick={onBack} style={cancelBtnStyle} disabled={busy}>취소</button>
          <button onClick={handleSave} style={{ ...saveBtnStyle, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkTypeEditor({ work, onChange, onToggleZone, onToggleAppliance }) {
  const isOn = work.role !== "none";
  const [zoneSearch, setZoneSearch] = useState("");

  const filteredSeoul = useMemo(
    () => zoneSearch ? SEOUL_DISTRICTS.filter(z => z.includes(zoneSearch)) : SEOUL_DISTRICTS,
    [zoneSearch]
  );
  const filteredGG = useMemo(
    () => zoneSearch ? GG_INCHEON.filter(z => z.includes(zoneSearch)) : GG_INCHEON,
    [zoneSearch]
  );

  return (
    <>
      <RadioRow
        options={Object.entries(ROLE_OPTIONS).map(([k, v]) => ({ key: k, label: v }))}
        value={work.role}
        onChange={(v) => onChange("role", v)}
      />

      {isOn && (
        <>
          {/* 가능 지역 */}
          <div style={{ marginTop: 16 }}>
            <div style={subLabelStyle}>가능 지역 ({work.zones.length})</div>
            <input
              type="text" placeholder="🔍 지역 검색 (예: 강남)"
              value={zoneSearch}
              onChange={(e) => setZoneSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <div style={subLabelStyle}>서울</div>
            <div style={chipGridStyle}>
              {filteredSeoul.map(z => (
                <ChipCheck key={z} label={z} on={work.zones.includes(z)} onClick={() => onToggleZone(z)}/>
              ))}
              {filteredSeoul.length === 0 && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>매칭 없음</span>
              )}
            </div>
            <div style={{ ...subLabelStyle, marginTop: 12 }}>경기/인천</div>
            <div style={chipGridStyle}>
              {filteredGG.map(z => (
                <ChipCheck key={z} label={z} on={work.zones.includes(z)} onClick={() => onToggleZone(z)}/>
              ))}
              {filteredGG.length === 0 && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>매칭 없음</span>
              )}
            </div>
          </div>

          {/* 가능 기종 */}
          <div style={{ marginTop: 16 }}>
            <div style={subLabelStyle}>가능 기종 ({work.appliances.length})</div>
            <div style={chipGridStyle}>
              {APPLIANCE_OPTIONS.map(a => (
                <ChipCheck key={a} label={a} on={work.appliances.includes(a)} onClick={() => onToggleAppliance(a)}/>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
              * 기종 미선택 시 지역만 매칭 (모든 기종 가능). 특정 기종만 선택하면 그 기종 작업만 매칭.
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={subLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function RadioRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = value === opt.key;
        const color = opt.color || "#FF1B8D";
        return (
          <div
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              padding: "8px 14px",
              background: active ? color + "20" : "var(--bg-secondary)",
              border: `1px solid ${active ? color : "var(--bg-tertiary)"}`,
              borderRadius: 7, fontSize: 12,
              color: active ? color : "var(--text-secondary)",
              cursor: "pointer", fontWeight: active ? 600 : 400,
              userSelect: "none",
            }}
          >{opt.label}</div>
        );
      })}
    </div>
  );
}

function ChipCheck({ label, on, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 12px",
        background: "var(--bg-secondary)",
        border: on ? "2px solid #FF1B8D" : "1px solid var(--border)",
        borderRadius: 6, fontSize: 11,
        color: on ? "#FF1B8D" : "var(--text-secondary)",
        cursor: "pointer", fontWeight: on ? 500 : 400,
        userSelect: "none",
      }}
    >{on ? "✓ " : ""}{label}</div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500 };
const deleteBtnStyle = {
  background: "rgba(239, 68, 68, 0.10)", border: "1px solid rgba(239, 68, 68, 0.30)",
  color: "#FF3D5A", fontSize: 12, fontWeight: 500,
  padding: "6px 12px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const sectionLabelStyle = {
  fontSize: 11, color: "var(--text-primary)", fontWeight: 600,
  letterSpacing: 0.3, marginBottom: 10, textTransform: "none",
};
const subLabelStyle = {
  fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500,
};
const inputStyle = {
  width: "100%", background: "var(--bg-secondary)",
  border: "1px solid var(--border)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const chipGridStyle = {
  display: "flex", flexWrap: "wrap", gap: 6,
};
const cancelBtnStyle = {
  flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};
const saveBtnStyle = {
  flex: 2, background: "#FF1B8D", border: "none",
  color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
  padding: 12, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit",
};

export default EngineerEditScreen;
