// 2026-06-18 — 사업자 정보 카드 (Mig 141 + Step B 어댑터).
//
// 양쪽 화면 재사용:
//   · 기사앱 EngineerMeTab — props: { userId=본인, actor=본인 }
//   · 운영자 기사관리 화면  — props: { userId=선택된 기사, actor=운영자 }
//
// 7필드: 상호 / 대표자명 / 사업자번호 / 사업장주소 / 과세유형(간이/일반) / 은행 / 계좌.
//   앞 5필드 → engineer_business_info, 뒤 2필드 → users (Mig 102 호환).
// 사업자번호는 onChange 마스크(000-00-00000) + 저장 전 재검증.
// 저장 결과는 onToast(text) 콜백으로 부모 토스트 시스템에 위임.

import { useEffect, useMemo, useState } from "react";
import {
  getEngineerBusinessInfo,
  upsertEngineerBusinessInfo,
  formatBusinessNo,
  isValidBusinessNo,
  TAX_TYPES,
} from "../lib/engineerBusinessInfoDb.js";

const FIELDS = [
  "business_name",
  "representative_name",
  "business_no",
  "business_address",
  "tax_type",
  "bank_name",
  "bank_account",
];

function emptyForm() {
  return {
    business_name:       "",
    representative_name: "",
    business_no:         "",
    business_address:    "",
    tax_type:            "",
    bank_name:           "",
    bank_account:        "",
  };
}

function rowToForm(row) {
  if (!row) return emptyForm();
  return {
    business_name:       row.business_name       || "",
    representative_name: row.representative_name || "",
    business_no:         row.business_no         || "",
    business_address:    row.business_address    || "",
    tax_type:            row.tax_type            || "",
    bank_name:           row.bank_name           || "",
    bank_account:        row.bank_account        || "",
  };
}

function diffPatch(initial, current) {
  const patch = {};
  for (const k of FIELDS) {
    const a = (initial[k] || "").trim();
    const b = (current[k] || "").trim();
    if (a !== b) patch[k] = b;
  }
  return patch;
}

export function EngineerBusinessInfoCard({
  userId,
  actor,
  isDark = false,
  cardStyle = {},
  onToast,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [initial, setInitial] = useState(emptyForm());
  const [form, setForm]       = useState(emptyForm());

  const isProxy = !!(userId && actor && userId !== actor);

  function showToast(msg) {
    if (typeof onToast === "function") onToast(msg);
  }

  async function reload() {
    if (!userId || !actor) {
      setLoading(false);
      setError("user_id / actor 누락");
      return;
    }
    setLoading(true);
    setError("");
    const res = await getEngineerBusinessInfo(userId, actor);
    if (!res?.ok) {
      setError(res?.error || "조회 실패");
      setLoading(false);
      return;
    }
    const f = rowToForm(res.row);
    setInitial(f);
    setForm(f);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, actor]);

  const patch = useMemo(() => diffPatch(initial, form), [initial, form]);
  const dirty = Object.keys(patch).length > 0;

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleBusinessNoChange(e) {
    setField("business_no", formatBusinessNo(e.target.value));
  }

  async function handleSave() {
    if (!dirty || saving) return;

    // 사전 검증 (RPC 도 재검증하지만 UX 위해 선반영)
    if (patch.business_no != null && patch.business_no !== "" && !isValidBusinessNo(patch.business_no)) {
      showToast("사업자번호 형식 오류 (000-00-00000)");
      return;
    }
    if (patch.tax_type != null && patch.tax_type !== "" && !TAX_TYPES.includes(patch.tax_type)) {
      showToast("과세유형 오류 (간이/일반)");
      return;
    }

    setSaving(true);
    const res = await upsertEngineerBusinessInfo(userId, patch, actor);
    setSaving(false);

    if (!res?.ok) {
      showToast(`⚠️ 저장 실패 — ${res?.error || "알 수 없음"}`);
      return;
    }
    showToast("✓ 사업자 정보 저장 완료");
    setInitial(form);
  }

  // ─── 스타일 ──────────────────────────────────────
  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: isDark ? "#BBB" : "#6B6359",
    marginBottom: 4,
    letterSpacing: "-0.1px",
  };
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
    borderRadius: 10,
    background: isDark ? "#0F0F0F" : "#FFFFFF",
    color: isDark ? "#FAF8F5" : "#1A1A1A",
    outline: "none",
    boxSizing: "border-box",
  };
  const fieldWrap = { marginBottom: 12 };

  function Field({ label, children }) {
    return (
      <div style={fieldWrap}>
        <div style={labelStyle}>{label}</div>
        {children}
      </div>
    );
  }

  function TaxToggle() {
    const opts = [
      { v: "간이", label: "간이과세" },
      { v: "일반", label: "일반과세" },
    ];
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {opts.map(opt => {
          const on = form.tax_type === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => setField("tax_type", on ? "" : opt.v)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${on ? "#FF1B8D" : (isDark ? "#2A2A2A" : "#EFE9E0")}`,
                background: on
                  ? (isDark ? "#2D0F1E" : "#FFE5F2")
                  : (isDark ? "#0F0F0F" : "#FFFFFF"),
                color: on
                  ? (isDark ? "#FF4DA6" : "#FF1B8D")
                  : (isDark ? "#FAF8F5" : "#1A1A1A"),
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, padding: 18 }}>
      <div style={{
        fontSize: 14, fontWeight: 700,
        color: isDark ? "#FAF8F5" : "#1A1A1A",
        marginBottom: 14,
        display: "flex", alignItems: "center", gap: 6,
        letterSpacing: "-0.1px",
      }}>
        🏢 사업자 정보
        {isProxy && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: isDark ? "#FF4DA6" : "#FF1B8D",
            marginLeft: 4,
          }}>
            (대리 입력)
          </span>
        )}
      </div>

      {loading && (
        <div style={{
          fontSize: 13, color: isDark ? "#999" : "#9A9A9A",
          padding: "12px 0",
        }}>
          불러오는 중…
        </div>
      )}

      {!loading && error && (
        <div style={{
          fontSize: 13, color: "#FF6B85",
          padding: "10px 12px",
          background: isDark ? "#2D0F0F" : "#FFEEF0",
          border: "1px solid #FF3B5C33",
          borderRadius: 10,
          marginBottom: 12,
        }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <Field label="상호">
            <input
              type="text"
              value={form.business_name}
              onChange={e => setField("business_name", e.target.value)}
              placeholder="예: 올데이케어"
              style={inputStyle}
            />
          </Field>

          <Field label="대표자명">
            <input
              type="text"
              value={form.representative_name}
              onChange={e => setField("representative_name", e.target.value)}
              placeholder="예: 홍길동"
              style={inputStyle}
            />
          </Field>

          <Field label="사업자번호 (000-00-00000)">
            <input
              type="text"
              inputMode="numeric"
              value={form.business_no}
              onChange={handleBusinessNoChange}
              placeholder="430-07-03167"
              maxLength={12}
              style={{
                ...inputStyle,
                fontFamily: "monospace",
                letterSpacing: 0.4,
              }}
            />
          </Field>

          <Field label="사업장 주소">
            <input
              type="text"
              value={form.business_address}
              onChange={e => setField("business_address", e.target.value)}
              placeholder="시·군·구 + 도로명 + 동/호"
              style={inputStyle}
            />
          </Field>

          <Field label="과세유형">
            <TaxToggle/>
          </Field>

          <Field label="은행">
            <input
              type="text"
              value={form.bank_name}
              onChange={e => setField("bank_name", e.target.value)}
              placeholder="예: 우리"
              style={inputStyle}
            />
          </Field>

          <Field label="계좌번호">
            <input
              type="text"
              value={form.bank_account}
              onChange={e => setField("bank_account", e.target.value)}
              placeholder="1005-104-865024"
              style={{
                ...inputStyle,
                fontFamily: "monospace",
                letterSpacing: 0.4,
              }}
            />
          </Field>

          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              width: "100%",
              padding: 13,
              background: (!dirty || saving)
                ? (isDark ? "#3A1F2A" : "#FFD4E5")
                : "#FF1B8D",
              border: "none", borderRadius: 12,
              color: (!dirty || saving)
                ? (isDark ? "#7A5A66" : "#B07A92")
                : "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: (!dirty || saving) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.1px",
              marginTop: 4,
            }}
          >
            {saving ? "저장 중…" : (dirty ? "💾 저장" : "변경 사항 없음")}
          </button>
        </>
      )}
    </div>
  );
}
