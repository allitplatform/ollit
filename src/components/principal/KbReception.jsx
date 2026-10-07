// 2026-10-07 Mig 255 — 쿨가이(KB) 접수 화면. 주방후드만.
//   · 항목은 주방후드 단가표(DB work_types)에서 고른다 → 견적은 자동. 쿨가이는 견적을 직접 고칠 수 없다.
//   · 0원 줄(2,000mm 초과 · 화구 스팀)이 들어가면 "견적 미정" 으로 접수 → 올데이케어가 견적을 넣는다.
//   · 저장은 기존 원청 접수와 같은 길(createTaskAdapter): 원청 KB · 미배정 · 채널 "원청앱".
//     수행처는 정하지 않는다 (올데이케어가 직영 / 협력사 가운데 고른다).
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { createTaskAdapter as createTask } from "../../data/tasksDb.js";
import { useHoodPrices } from "../../lib/serviceCatalog.js";
import { HOOD_LIST_SERVICES, HOOD_PRICE_HINT, hoodAutoEstimate, withHoodQuotes } from "../../utils/receptionForm.js";
import { extractRegion } from "../../utils/partnerPasteParser.js";
import { fmtWon } from "../../utils/money.js";

const EMPTY = { customer: "", phone: "", address: "", date: "", time: "", memo: "" };

export function KbReception({ t, user, onDone }) {
  const prices = useHoodPrices();
  const list = prices.ok ? prices.list : null;
  const [form, setForm] = useState(EMPTY);
  const [qty, setQty] = useState({});          // "서비스|줄" → 수량
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: null })); };

  const items = useMemo(() => {
    const out = [];
    if (!list) return out;
    for (const svc of HOOD_LIST_SERVICES) {
      for (const line of Object.keys(list[svc] || {})) {
        const n = Number(qty[`${svc}|${line}`]) || 0;
        if (n > 0) out.push({ workType: svc, appliance: line, qty: n });
      }
    }
    return out;
  }, [list, qty]);
  const auto = items.length > 0 ? hoodAutoEstimate(items, list) : undefined;   // 숫자 = 자동 견적 / null = 견적 미정
  const tbd = items.length > 0 && !(Number(auto) > 0);

  const bump = (key, d) => {
    setQty(p => ({ ...p, [key]: Math.max(0, Math.min(20, (Number(p[key]) || 0) + d)) }));
    if (errors.items) setErrors(p => ({ ...p, items: null }));
  };

  async function submit() {
    if (busy) return;
    const errs = {};
    if (!form.customer.trim()) errs.customer = "고객 이름을 입력해 주세요";
    if (form.phone.replace(/[^0-9]/g, "").length < 9) errs.phone = "전화번호를 입력해 주세요";
    if (!form.address.trim()) errs.address = "주소를 입력해 주세요";
    if (items.length === 0) errs.items = "작업 항목을 1개 이상 골라 주세요";
    if (form.time && !form.date) errs.date = "날짜도 함께 골라 주세요";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const total = tbd ? 0 : Number(auto) || 0;
    const workItems = tbd ? items.map(it => ({ ...it, quote: 0 })) : withHoodQuotes(items, list, total);
    const head = workItems[0] || {};
    const hasDate = !!form.date;
    setBusy(true); setFailed("");
    try {
      const res = await createTask({
        principalCode: "KB",
        channel:       "원청앱",
        paymentMethod: null,
        customer:      form.customer.trim(),
        phone:         form.phone.trim(),
        address:       form.address.trim(),
        region:        extractRegion(form.address),
        workType:      head.workType,
        appliance:     head.appliance,
        qty:           head.qty || 1,
        workItems,
        quote:         total,
        estimateTotal: total,
        scheduledDate: hasDate ? form.date : null,
        scheduledTime: hasDate ? (form.time || null) : null,
        memo:          form.memo.trim(),
        status:        "미배정",
        scheduleType:  hasDate ? "specific" : "tbd",
      }, {
        changedBy:     user?.user_id || user?.id || null,
        changedByName: user?.name || null,
        changedByRole: "원청",
      });
      setBusy(false);
      if (!res.ok) { setFailed(res.error || "접수하지 못했습니다."); return; }
      setForm(EMPTY); setQty({});
      if (onDone) onDone({ taskNo: res.task_no || res.taskNo || "", tbd });
    } catch (e) {
      setBusy(false);
      setFailed((e && e.message) || "접수하지 못했습니다.");
    }
  }

  const input = (bad) => ({
    width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 16, fontFamily: "inherit",
    background: t.bgInset, color: t.text, border: `1px solid ${bad ? t.danger : t.border}`, borderRadius: 10, outline: "none",
  });
  const label = { fontSize: 12.5, fontWeight: 700, color: t.textSecondary, margin: "14px 2px 6px" };
  const errText = (k) => errors[k] ? <div style={{ fontSize: 12, color: t.danger, margin: "4px 2px 0" }}>{errors[k]}</div> : null;

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={label}>고객 이름 *</div>
      <input value={form.customer} onChange={e => set("customer", e.target.value)} placeholder="예: 김철수 / ○○식당" style={input(errors.customer)}/>
      {errText("customer")}
      <div style={label}>전화번호 *</div>
      <input value={form.phone} onChange={e => set("phone", e.target.value)} inputMode="tel" placeholder="010-0000-0000" style={input(errors.phone)}/>
      {errText("phone")}
      <div style={label}>주소 *</div>
      <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="도로명 또는 지번 주소, 상세 주소까지" style={input(errors.address)}/>
      {errText("address")}

      <div style={label}>작업 항목 * <span style={{ fontWeight: 500, color: t.textMuted }}>(주방후드)</span></div>
      {!prices.ready && <div style={{ fontSize: 13, color: t.textMuted, padding: "8px 2px" }}>단가표를 불러오는 중...</div>}
      {prices.ready && !list && (
        <div style={{ fontSize: 13, color: t.danger, padding: "8px 2px" }}>단가표를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</div>
      )}
      {list && HOOD_LIST_SERVICES.filter(svc => list[svc]).map(svc => (
        <div key={svc} style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 4 }}>{svc}</div>
          {Object.keys(list[svc]).map(line => {
            const key = `${svc}|${line}`;
            const n = Number(qty[key]) || 0;
            const p = Number(list[svc][line]) || 0;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px dashed ${t.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: n > 0 ? 800 : 600, color: n > 0 ? t.accent : t.text }}>{line}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{p > 0 ? fmtWon(p) : (HOOD_PRICE_HINT[key] ? "현장 확인 후 견적" : "견적 미정")}</div>
                </div>
                <button type="button" onClick={() => bump(key, -1)} disabled={n === 0} aria-label="줄이기" style={{
                  width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.border}`, background: "transparent",
                  color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: n === 0 ? 0.35 : 1,
                }}><Minus size={16}/></button>
                <div style={{ width: 22, textAlign: "center", fontSize: 15, fontWeight: 800, color: t.text }}>{n}</div>
                <button type="button" onClick={() => bump(key, 1)} aria-label="늘리기" style={{
                  width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.accent}`, background: t.accentBg,
                  color: t.accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}><Plus size={16}/></button>
              </div>
            );
          })}
        </div>
      ))}
      {errText("items")}

      <div style={{ background: t.bgElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, color: t.textMuted }}>견적 (자동)</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: tbd ? t.warning : t.text }}>
            {items.length === 0 ? "—" : tbd ? "견적 미정" : fmtWon(auto)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          {tbd
            ? "현장 확인이 필요한 항목이 있습니다. 올데이케어가 확인한 뒤 견적을 넣습니다."
            : "단가표 기준으로 계산됩니다. 금액 변경이 필요하면 요청사항에 적어 주세요."}
        </div>
      </div>

      <div style={label}>희망 일시 <span style={{ fontWeight: 500, color: t.textMuted }}>(없으면 비워 두세요)</span></div>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={{ ...input(errors.date), flex: 1.4 }}/>
        <input type="time" value={form.time} onChange={e => set("time", e.target.value)} style={{ ...input(false), flex: 1 }}/>
      </div>
      {errText("date")}
      <div style={label}>요청사항</div>
      <textarea value={form.memo} onChange={e => set("memo", e.target.value)} rows={3} placeholder="주차, 영업 시간, 후드 상태 등" style={{ ...input(false), resize: "vertical" }}/>

      {failed && <div style={{ fontSize: 13, color: t.danger, marginTop: 12 }}>{failed}</div>}
      <button type="button" onClick={submit} disabled={busy || !list} style={{
        width: "100%", marginTop: 16, padding: 16, border: "none", borderRadius: 12, fontFamily: "inherit",
        background: t.accent, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", opacity: busy || !list ? 0.6 : 1,
      }}>{busy ? "접수하는 중..." : "올데이케어에 접수"}</button>
      <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center", margin: "10px 0 4px" }}>
        접수한 작업은 올데이케어가 일정을 잡습니다. 배정 전까지는 작업 화면에서 취소할 수 있습니다.
      </div>
    </div>
  );
}
