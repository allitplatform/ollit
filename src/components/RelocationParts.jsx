// 2026-10-07 Mig 259 — 이전설치 화면 부품.
//   RelocationFields : 접수 화면 — 설치 주소(+ 메모) · 철거비 · 설치비 입력 (위의 기존 주소 칸 = 철거 주소)
//   RelocationBlocks : 작업 상세 · 기사 작업 화면 — 철거(출발) / 설치(도착) 두 블록 + 지도 열기 · 주소 복사
import { useState } from "react";
import { mapSearchLinks, relocationFees } from "../utils/relocation.js";

const won = (n) => `₩${(Math.round(Number(n) || 0)).toLocaleString("ko-KR")}`;
const digits = (v) => { const d = String(v || "").replace(/\D/g, ""); return d ? parseInt(d, 10) : 0; };

export function RelocationFields({ value, onChange, error = "" }) {
  const v = value || {};
  const set = (k, x) => onChange({ ...v, [k]: x });
  const input = (bad) => ({
    width: "100%", boxSizing: "border-box", padding: "11px 12px", fontSize: 15, fontFamily: "inherit", outline: "none",
    background: "var(--bg-secondary)", color: "var(--text-primary)", borderRadius: 9,
    border: `1px solid ${bad ? "var(--danger, #E5484D)" : "var(--border)"}`,
  });
  const label = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "10px 0 5px" };
  const sum = (Number(v.removeFee) || 0) + (Number(v.installFee) || 0);
  return (
    <div style={{ margin: "10px 0", padding: "12px 14px", borderRadius: 12, border: "1px solid #6366F1", background: "rgba(99,102,241,0.07)" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#6366F1" }}>🛠 이전설치 — 주소 2곳 · 견적 2개</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.5 }}>
        위에 적은 주소가 <b>철거(출발) 주소</b>입니다. 아래에 설치(도착) 주소를 적어 주세요.
      </div>
      <div style={label}>설치 주소 (도착) *</div>
      <input type="text" value={v.destAddress || ""} onChange={e => set("destAddress", e.target.value)} placeholder="도로명 주소" style={input(!!error)}/>
      {error && <div style={{ fontSize: 12, color: "var(--danger, #E5484D)", marginTop: 4, fontWeight: 700 }}>{error}</div>}
      <div style={label}>설치 주소 메모 (층 · 엘리베이터 · 실외기 위치)</div>
      <input type="text" value={v.destDetail || ""} onChange={e => set("destDetail", e.target.value)} placeholder="예: 5층 · 엘리베이터 있음 · 실외기 베란다" style={input(false)}/>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={label}>철거비</div>
          <input type="text" inputMode="numeric" value={v.removeFee ? String(v.removeFee) : ""} onChange={e => set("removeFee", digits(e.target.value))} placeholder="숫자만" style={input(false)}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>설치비</div>
          <input type="text" inputMode="numeric" value={v.installFee ? String(v.installFee) : ""} onChange={e => set("installFee", digits(e.target.value))} placeholder="숫자만" style={input(false)}/>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
        {sum > 0 ? <>견적 = 철거비 + 설치비 = <b style={{ color: "var(--text-primary)" }}>{won(sum)}</b> (아래 견적 칸에 자동으로 들어갑니다)</>
                 : "철거비 · 설치비를 비워 두면 아래 견적 칸의 금액 한 줄로 저장됩니다."}
      </div>
    </div>
  );
}

function Block({ tone, title, address, detail, fee }) {
  const [copied, setCopied] = useState(false);
  const has = !!String(address || "").trim();
  const links = mapSearchLinks(address);
  const linkBtn = {
    display: "inline-block", padding: "7px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none",
    border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-elevated)", fontFamily: "inherit", cursor: "pointer",
  };
  async function copy() {
    try { await navigator.clipboard.writeText(String(address || "")); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (_e) { window.prompt("주소를 복사해 주세요", String(address || "")); }
  }
  return (
    <div style={{ padding: "11px 13px", borderRadius: 12, border: "1px solid var(--border)", borderLeft: `4px solid ${tone}`, background: "var(--bg-elevated)", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: tone }}>{title}</span>
        {fee != null && <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{won(fee)}</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: has ? "var(--text-primary)" : "var(--danger, #E5484D)", margin: "4px 0 2px", wordBreak: "keep-all" }}>
        {has ? address : "주소가 아직 없습니다"}
      </div>
      {detail && <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{detail}</div>}
      {has && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <a href={links.kakao} target="_blank" rel="noreferrer" style={linkBtn}>카카오맵</a>
          <a href={links.tmap} target="_blank" rel="noreferrer" style={linkBtn}>티맵</a>
          <a href={links.naver} target="_blank" rel="noreferrer" style={linkBtn}>네이버지도</a>
          <button type="button" onClick={copy} style={linkBtn}>{copied ? "복사됨 ✓" : "주소 복사"}</button>
        </div>
      )}
    </div>
  );
}

// showFees: 철거비 · 설치비를 같이 보여 줄지 (기사 화면에서는 끈다 — 기사에게는 내 몫만 보인다)
export function RelocationBlocks({ task, showFees = false, style = {} }) {
  if (!task) return null;
  const fees = showFees ? relocationFees(task) : null;
  return (
    <div style={style}>
      <Block tone="#F97316" title="① 철거 (출발)" address={task.fullAddress || task.address} fee={fees ? fees.removeFee : null}/>
      <Block tone="#6366F1" title="② 설치 (도착)" address={task.destAddress || task.dest_address} detail={task.destDetail || task.dest_detail} fee={fees ? fees.installFee : null}/>
    </div>
  );
}
