// 2026-09-16 — 올잇 마케팅 PWA v2: 광고 관리 허브 (src/pages/MarketingPwaApp.jsx)
//   진입: ollit.vercel.app/mkt (운영자, 올잇 계정 owner) / ollit.vercel.app/mkt/c/<token> (광고주 열람, 로그인 없음)
//   서버: api/ad-hub.js — 광고주 목록은 DB(ad_advertisers). 화면 코드에 계정 키 없음.
//   구조: 사이드바(광고주 목록 + 추가) → AdPanel(성과·접수당 광고비·비즈머니·일별·접수 입력·변경 이력)
//   이전 버전(유솔/올데이 고정 배열)은 MarketingPwaApp.jsx.before-adhub-260916 에 보존.

import { useEffect, useMemo, useState, useCallback } from "react";
import { Sun, Moon, LogOut, ExternalLink, Plus, Settings, Link as LinkIcon, RefreshCw } from "lucide-react";

const THEMES = {
  dark: {
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    success: "#10B981", warning: "#FFB800", danger: "#FF3D5A",
  },
  light: {
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    success: "#16A34A", warning: "#D97706", danger: "#DC2626",
  },
};
function sectionsFor(owner, showKeywords) {
  return [
    { id: "perf", label: "성과", icon: "📊" },
    ...(owner ? [{ id: "autobid", label: "자동입찰", icon: "🤖" }, { id: "shield", label: "부정클릭", icon: "🛡" }] : []),
    ...((owner || showKeywords) ? [{ id: "keywords", label: "키워드", icon: "🔑" }] : []),
    { id: "log", label: owner ? "이력·공유" : "변경 이력", icon: "📝" },
    ...(owner ? [{ id: "report", label: "보고서", icon: "📄" }] : []),
  ];
}
function useSection() {
  const [section, setSection] = useState(() => { try { return localStorage.getItem("mkt_section") || "perf"; } catch { return "perf"; } });
  const pick = useCallback((id) => { setSection(id); try { localStorage.setItem("mkt_section", id); } catch { /* */ } }, []);
  return [section, pick];
}
const PERIODS = [
  { id: "today", label: "오늘" },
  { id: "week",  label: "최근 7일" },
  { id: "month", label: "이번 달" },
];
function kstYmd(offsetDays) {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + (offsetDays || 0));
  return d.toISOString().slice(0, 10);
}
function won(n) { return Number(n || 0).toLocaleString("ko-KR"); }
function fmtAgo(iso) {
  if (!iso) return "-";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "방금"; if (m < 60) return `${m}분 전`; if (m < 24 * 60) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}
function fmtKst(iso) { if (!iso) return "-"; const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); return d.toISOString().slice(5, 16).replace("T", " "); }
function useTheme(key = "mkt_theme", def = "dark") {
  const [mode, setMode] = useState(() => { try { const v = localStorage.getItem(key); return v === "light" || v === "dark" ? v : def; } catch { return def; } });
  const toggle = () => { const n = mode === "dark" ? "light" : "dark"; setMode(n); try { localStorage.setItem(key, n); } catch { /* */ } };
  return { mode, t: THEMES[mode], toggle };
}
function useIsPc() {
  const [isPc, setIsPc] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  useEffect(() => { const f = () => setIsPc(window.innerWidth >= 1024); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return isPc;
}
async function api(mode, { actor, get, post } = {}) {
  const qs = new URLSearchParams({ mode, ...(actor ? { actor } : {}), ...(get || {}) }).toString();
  const r = post
    ? await fetch(`/api/ad-hub?${qs}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(actor ? { actor } : {}), ...post }) })
    : await fetch(`/api/ad-hub?${qs}`, { cache: "no-store" });
  return r.json();
}
const STYLE = `
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: slideUp 0.4s ease-out; }
  .tab-btn:hover { opacity: 0.85; }
  .mkt-input { font-family: inherit; font-size: 13px; padding: 9px 10px; border-radius: 8px; outline: none; width: 100%; box-sizing: border-box; }
`;

// ===================== 운영자 화면 =====================
export default function MarketingPwaApp({ user, onLogout }) {
  const reportMatch = typeof window !== "undefined" ? /^\/mkt\/report\/([0-9a-f-]{36})\/?$/i.exec(window.location.pathname) : null;
  if (reportMatch) return <ReportView advId={reportMatch[1]} user={user}/>;
  return <MarketingHub user={user} onLogout={onLogout}/>;
}
function MarketingHub({ user, onLogout }) {
  const { mode, t, toggle } = useTheme();
  const isPc = useIsPc();
  const actor = user?.user_id || user?.userId || user?.id;
  const [advs, setAdvs] = useState(null);
  const [advId, setAdvId] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | advertiser object
  const [err, setErr] = useState(null);
  const [section, pickSection] = useSection();

  const reload = useCallback(async () => {
    const j = await api("list", { actor });
    if (j.ok) { setAdvs(j.advertisers); setAdvId(prev => prev && j.advertisers.some(a => a.id === prev) ? prev : null); }
    else setErr(j.error || "불러오기 실패");
  }, [actor]);
  useEffect(() => { reload(); }, [reload]);

  const activeAdvs = (advs || []).filter(a => a.active);
  const adv = activeAdvs.find(a => a.id === advId) || null;

  const homeOn = !advId && !editing;
  const sideList = (
    <>
      <button onClick={() => { setAdvId(null); setEditing(null); }} className="tab-btn" style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: isPc ? "12px 14px" : "9px 12px",
        background: homeOn ? t.accentBg : "transparent", border: isPc ? "none" : `1px solid ${homeOn ? t.accent : t.border}`,
        borderLeft: isPc ? `3px solid ${homeOn ? t.accent : "transparent"}` : undefined, borderRadius: 8,
        color: homeOn ? t.accent : t.textSecondary, fontSize: 13.5, fontWeight: homeOn ? 800 : 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", whiteSpace: "nowrap",
      }}>🏠 전체 현황</button>
      {activeAdvs.map(a => {
        const on = advId === a.id;
        return (
          <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button onClick={() => { setAdvId(a.id); setEditing(null); }} className="tab-btn" style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: isPc ? "12px 14px" : "9px 12px",
              background: on ? t.accentBg : "transparent", border: isPc ? "none" : `1px solid ${on ? t.accent : t.border}`,
              borderLeft: isPc ? `3px solid ${on ? t.accent : "transparent"}` : undefined, borderRadius: 8,
              color: on ? t.accent : t.textSecondary, fontSize: 13.5, fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", whiteSpace: "nowrap",
            }}>{a.name}</button>
            {isPc && on && !editing && sectionsFor(true, a.show_keywords).map(sc => { const sel = section === sc.id; return (
              <button key={sc.id} onClick={() => pickSection(sc.id)} className="tab-btn" style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 8px 30px", background: sel ? t.bgInset : "transparent", border: "none", borderRadius: 8,
                color: sel ? t.text : t.textMuted, fontSize: 12.5, fontWeight: sel ? 800 : 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}><span style={{ fontSize: 12 }}>{sc.icon}</span>{sc.label}</button>
            ); })}
          </div>
        );
      })}
      <button onClick={() => setEditing("new")} className="tab-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: isPc ? "11px 14px" : "9px 12px", background: "transparent", border: `1px dashed ${t.borderStrong}`, borderRadius: 8, color: t.textMuted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        <Plus size={14}/> 광고주 추가
      </button>
    </>
  );

  const body = (
    <>
      {err && <Card t={t} title="오류"><div style={{ color: t.danger, fontSize: 12 }}>{err}</div></Card>}
      {editing && (
        <AdvertiserForm t={t} actor={actor} actorName={user?.name} initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)} onSaved={async (saved) => { setEditing(null); await reload(); if (saved?.id) setAdvId(saved.id); }}/>
      )}
      {!editing && adv && (
        <AdPanel key={adv.id} t={t} isPc={isPc} adv={adv} actor={actor} actorName={user?.name} owner section={section} onSection={pickSection} sideNav={isPc} onEdit={() => setEditing(adv)}/>
      )}
      {!editing && !adv && advs && activeAdvs.length > 0 && (
        <Overview t={t} isPc={isPc} actor={actor} onPick={(id, sec) => { setAdvId(id); if (sec) pickSection(sec); }}/>
      )}
      {!editing && !adv && advs && activeAdvs.length === 0 && (
        <Card t={t} title="광고주가 없습니다" sub="왼쪽 '광고주 추가'에서 네이버 검색광고 API 키를 등록하세요">
          <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>광고시스템 → 도구 → API 사용 관리에서 액세스라이선스·비밀키를 발급받아 입력합니다. CUSTOMER_ID 는 같은 화면 상단에 있습니다.</div>
        </Card>
      )}
      {!advs && !err && <Card t={t} title="불러오는 중…"><div style={{ fontSize: 12, color: t.textMuted }}>광고주 목록</div></Card>}
    </>
  );

  if (isPc) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Pretendard', sans-serif", display: "flex" }}>
        <style>{STYLE}</style>
        <aside style={{ width: 230, flexShrink: 0, background: t.bgElevated, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${t.border}` }}>
            <div className="mono" style={{ fontSize: 9, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>ALLIT MARKETING</div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>📈 올잇 마케팅</div>
            <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: 3 }}>{user?.name ? `${user.name} 님` : ""} · 광고주 {activeAdvs.length}곳</div>
          </div>
          <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }}>{sideList}</nav>
          <div style={{ padding: "10px 14px 0", borderTop: `1px solid ${t.border}` }}>
            <a href="/ads-console.html" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: t.textMuted, textDecoration: "none", fontWeight: 700, padding: "6px 0" }}><ExternalLink size={12}/> 올데이 키워드 관제판</a>
          </div>
          <div style={{ padding: "8px 14px 18px", display: "flex", gap: 8 }}>
            <button onClick={toggle} className="tab-btn" style={btnGhost(t)}>{mode === "dark" ? <Sun size={14}/> : <Moon size={14}/>} 테마</button>
            <button onClick={onLogout} className="tab-btn" style={btnGhost(t)}><LogOut size={14}/> 로그아웃</button>
          </div>
        </aside>
        <main className="fade-in" style={{ flex: 1, minWidth: 0, overflow: "auto", height: "100vh", padding: "24px 28px 40px" }}>
          <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>{body}</div>
        </main>
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100vh", background: t.bg, paddingTop: "env(safe-area-inset-top, 12px)" }}>
      <style>{STYLE}</style>
      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${t.border}`, background: t.bgElevated, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📈 올잇 마케팅</div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 1 }}>{user?.name ? `${user.name} 님 · ` : ""}관리 광고주 {activeAdvs.length}곳</div>
          </div>
          <button onClick={toggle} className="tab-btn" aria-label="테마 전환" style={iconBtn(t)}>{mode === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button onClick={onLogout} className="tab-btn" aria-label="로그아웃" style={iconBtn(t)}><LogOut size={18}/></button>
        </div>
        <div className="fade-in" style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>{sideList}</div>
          {body}
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, textAlign: "center", padding: "4px 2px" }}>ALLIT MARKETING · 홈 화면에 추가하면 앱처럼 쓸 수 있어요</div>
        </div>
      </div>
    </div>
  );
}

// ===================== 광고주 열람 화면 (/mkt/c/<token>) =====================
export function ClientAdView({ token }) {
  const { mode, t, toggle } = useTheme("mkt_client_theme", "light"); // 광고주 화면은 흰 배경 기본 (가독성)
  const isPc = useIsPc();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    api("client", { get: { token, since: kstYmd(0), until: kstYmd(0) } }).then(j => { if (j.ok) setInfo(j.advertiser); else setErr(j.error || "링크 오류"); }).catch(() => setErr("연결 실패"));
  }, [token]);
  useEffect(() => { if (info?.name) document.title = `${info.name} 광고 현황`; }, [info]);
  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Pretendard', sans-serif", paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <style>{STYLE}</style>
      <div style={{ maxWidth: isPc ? 980 : 420, margin: "0 auto", minHeight: "100vh", paddingBottom: 40, zoom: 1.15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${t.border}`, background: t.bgElevated, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>📈 {info?.name || "광고"} 광고 현황</div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 1 }}>올잇 마케팅이 관리하는 네이버 광고 · 실시간</div>
          </div>
          <button onClick={toggle} className="tab-btn" aria-label="테마 전환" style={iconBtn(t)}>{mode === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
        </div>
        <div className="fade-in" style={{ padding: isPc ? "20px 24px" : "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <Card t={t} title="열 수 없습니다"><div style={{ fontSize: 12, color: t.danger }}>{err}</div></Card>}
          {info && <AdPanel t={t} isPc={isPc} adv={info} token={token} owner={false}/>}
          {!info && !err && <Card t={t} title="불러오는 중…"><div style={{ fontSize: 12, color: t.textMuted }}>광고 계정 연결</div></Card>}
        </div>
      </div>
    </div>
  );
}

// ===================== 성과 패널 (운영자·광고주 공용) =====================
function AdPanel({ t, isPc, adv, actor, actorName, token, owner, onEdit, section: sectionProp, onSection, sideNav }) {
  const [period, setPeriod] = useState("today");
  const [localSection, pickLocal] = useSection();
  const section = sectionProp ?? localSection;
  const pickSection = onSection || pickLocal;
  const sections = useMemo(() => sectionsFor(owner, adv.show_keywords), [owner, adv.show_keywords]);
  useEffect(() => { if (!sections.some(x => x.id === section)) pickSection("perf"); }, [sections, section, pickSection]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const { since, until } = useMemo(() => {
    const today = kstYmd(0);
    if (period === "today") return { since: kstYmd(-1), until: today };
    if (period === "week")  return { since: kstYmd(-6), until: today };
    return { since: today.slice(0, 8) + "01", until: today };
  }, [period]);
  const load = useCallback(() => {
    setLoading(true);
    const p = owner ? api("stats", { actor, get: { id: adv.id, since, until } }) : api("client", { get: { token, since, until } });
    return p.then(j => { setData(j && j.ok ? j : null); setLoading(false); }).catch(() => { setData(null); setLoading(false); });
  }, [owner, actor, token, adv.id, since, until]);
  useEffect(() => { load(); }, [load, tick]);
  useEffect(() => { const iv = setInterval(() => setTick(x => x + 1), 5 * 60 * 1000); return () => clearInterval(iv); }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const isToday = period === "today";
    const days = (data.days || []).slice().sort((a, b) => a.ymd < b.ymd ? 1 : -1);
    const rangeDays = isToday ? days.filter(d => d.ymd === until) : days;
    const sum = rangeDays.reduce((a, d) => ({ cost: a.cost + d.cost, clicks: a.clicks + d.clicks, imp: a.imp + d.impressions, conv: a.conv + d.conv }), { cost: 0, clicks: 0, imp: 0, conv: 0 });
    const costVat = Math.round(sum.cost * 1.1);
    const leads = data.leads || {};
    const leadTotal = rangeDays.reduce((a, d) => a + Number(leads[d.ymd]?.leads || 0), 0);
    const denom = leadTotal > 0 ? leadTotal : (sum.conv > 0 ? sum.conv : 0);
    const per = denom > 0 ? Math.round(costVat / denom) : null;
    const good = adv.cpa_good, limit = adv.cpa_limit;
    let verdict;
    if (per == null) verdict = { label: costVat > 0 ? (owner ? "접수 입력 대기" : "접수 건수 입력 후 계산") : "지출 없음", color: t.textMuted };
    else if (good && per <= good) verdict = { label: "효율 좋음", color: t.success };
    else if (limit && per <= limit) verdict = { label: "적정", color: t.warning };
    else if (limit) verdict = { label: "상한 초과", color: t.danger };
    else verdict = { label: owner ? "판정선 미설정" : "기준 설정 전", color: t.textMuted };
    const cpc = sum.clicks ? Math.round(sum.cost / sum.clicks) : 0;
    const ctr = sum.imp ? (sum.clicks / sum.imp * 100) : 0;
    // 비즈머니 잔여일: 최근 7일 평균 일지출(VAT 포함) 기준
    const last7 = days.slice(0, 7).filter(d => d.ymd !== until);
    const avgDay = last7.length ? Math.round(last7.reduce((a, d) => a + d.cost * 1.1, 0) / last7.length) : 0;
    const biz = data.bizmoney;
    const bizDays = biz != null && avgDay > 0 ? (biz / avgDay) : null;
    const todayRow = days.find(d => d.ymd === until);
    const yRow = days.find(d => d.ymd === kstYmd(-1));
    const rank = isToday && todayRow ? todayRow.rank : data.totals?.rank;
    const prevRows = days.filter(d => d.ymd !== until).slice(0, 7);
    const avgClicks = prevRows.length ? prevRows.reduce((a, d) => a + d.clicks, 0) / prevRows.length : 0;
    const clickAlert = todayRow && avgClicks > 0 && todayRow.clicks >= 20 && todayRow.clicks / avgClicks >= 2.5;
    // 오늘 탭: 캠페인별 수치도 오늘 하루만 (조회 범위는 어제~오늘)
    let camps = data.campaigns || [];
    if (isToday && todayRow?.perCamp) {
      const nameById = Object.fromEntries(camps.map(c => [c.id, c]));
      camps = todayRow.perCamp.map(p => ({ ...(nameById[p.campaign_id] || { id: p.campaign_id, name: p.campaign_id }), ...p })).sort((a, b) => b.cost - a.cost);
    }
    const alerts = [];
    const bizLow = biz != null && (biz <= 50000 || (bizDays != null && bizDays < 1));
    if (bizLow) alerts.push({ level: "danger", text: `비즈머니 ${won(Math.round(biz))}원${bizDays != null ? ` (약 ${bizDays.toFixed(1)}일분)` : ""} — 곧 광고 중단, 충전 필요` });
    if (clickAlert) alerts.push({ level: "danger", text: `클릭 급증 의심 — 오늘 ${todayRow.clicks}클릭, 직전 평균 ${Math.round(avgClicks)}의 ${(todayRow.clicks / Math.max(avgClicks, 1)).toFixed(1)}배` });
    if (data.autobid?.last?.error) alerts.push({ level: "danger", text: `자동입찰 오류: ${data.autobid.last.error.slice(0, 80)}` });
    if (data.autobid?.enabled && data.autobid.last && Date.now() - new Date(data.autobid.last.at).getTime() > 2 * 3600 * 1000) alerts.push({ level: "warning", text: `자동입찰이 ${fmtAgo(data.autobid.last.at)} 이후 안 돌았습니다 — 스케줄 확인` });
    if (data.autobid?.enabled && data.cron_ready === false) alerts.push({ level: "warning", text: "서버 CRON_SECRET 미설정 — 자동입찰이 자동으로 돌지 않습니다" });
    if (data.ips?.new24h) alerts.push({ level: "warning", text: `최근 24시간 차단 IP ${data.ips.new24h}개 추가` });
    if (limit && per != null && per > limit) alerts.push({ level: "danger", text: `접수당 광고비 ${won(per)}원 — 상한 ${won(limit)}원 초과` });
    return { alerts, bizLow, yRow, isToday, costVat, sum, cpc, ctr, per, verdict, rank, leadTotal, days: rangeDays, allDays: days, biz, bizDays, avgDay, clickAlert, todayClicks: todayRow?.clicks || 0, avgClicks: Math.round(avgClicks), camps, logs: data.logs || [] };
  }, [data, adv, period, until, t, owner]);

  const saveLead = async (ymd, leads, note) => {
    const j = owner ? await api("leads", { actor, post: { id: adv.id, ymd, leads, note } }) : await api("client_leads", { post: { token, ymd, leads, note } });
    if (j.ok) setData(d => d ? { ...d, leads: { ...(d.leads || {}), [ymd]: { leads: Number(leads || 0), note } } } : d);
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {PERIODS.map(p => { const on = period === p.id; return (
          <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className="tab-btn" style={{ flex: 1, padding: "8px 0", background: on ? t.accentBg : "transparent", border: `1px solid ${on ? t.accent : t.border}`, borderRadius: 10, color: on ? t.accent : t.textSecondary, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{p.label}</button>
        ); })}
        <button onClick={() => setTick(x => x + 1)} className="tab-btn" aria-label="새로고침" style={{ ...iconBtn(t), border: `1px solid ${t.border}`, borderRadius: 10, padding: 8 }}><RefreshCw size={14}/></button>
        {owner && <button onClick={onEdit} className="tab-btn" aria-label="설정" style={{ ...iconBtn(t), border: `1px solid ${t.border}`, borderRadius: 10, padding: 8 }}><Settings size={14}/></button>}
      </div>
      <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: -6 }}>
        {period === "today" ? `${until} (오늘)` : `${since} ~ ${until}`}{owner ? " · KST · 5분마다 갱신" : " · 5분마다 자동 새로고침"}{loading ? " · 조회 중…" : ""}
      </div>
      {view && view.alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {view.alerts.map((a, i) => { const c = a.level === "danger" ? t.danger : t.warning; return (
            <div key={i} style={{ padding: "8px 12px", borderRadius: 10, background: `${c}1A`, border: `1px solid ${c}55`, color: c, fontSize: 12, fontWeight: 800 }}>{a.level === "danger" ? "🚨" : "⚠"} {a.text}</div>
          ); })}
        </div>
      )}
      {!sideNav && (
        <div style={{ display: "flex", gap: 4, padding: 4, background: t.bgInset, borderRadius: 12, overflowX: "auto" }}>
          {sections.map(sc => { const on = section === sc.id; return (
            <button key={sc.id} type="button" onClick={() => pickSection(sc.id)} className="tab-btn" style={{ flex: 1, minWidth: 80, padding: "9px 6px", background: on ? t.bgElevated : "transparent", border: "none", boxShadow: on ? "0 1px 4px rgba(0,0,0,.18)" : "none", borderRadius: 9, color: on ? t.text : t.textMuted, fontSize: 12.5, fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{sc.icon} {sc.label}</button>
          ); })}
        </div>
      )}

      {!view ? (
        <Card t={t} title={`${adv.name} 광고 성과`}><div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>{loading ? "네이버에서 불러오는 중…" : "연결 실패 — 잠시 후 새로고침"}</div></Card>
      ) : (
        <>
          {section === "perf" && <>
          <Card t={t} title={`${adv.name} 광고 성과`} sub={adv.cpa_limit ? `접수당 광고비 ${won(adv.cpa_good)}원 이하 효율 / ${won(adv.cpa_limit)}원 상한${adv.margin_per_order ? ` (건당 이익 ${won(adv.margin_per_order)}원 기준)` : ""}` : owner ? "판정선 미설정 — 설정에서 건당 이익 입력" : "접수당 광고비 기준은 담당자와 협의 후 설정됩니다"}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                {view.per != null ? won(view.per) : "-"}<span style={{ fontSize: 13, color: t.textMuted, fontWeight: 700, marginLeft: 3 }}>원/접수</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: view.verdict.color, background: `${view.verdict.color}1F`, borderRadius: 999, padding: "4px 11px" }}>{view.verdict.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${isPc ? 5 : 2}, minmax(0, 1fr))`, gap: 8 }}>
              <div style={{ gridColumn: isPc ? "auto" : "1 / -1" }}><MiniStat t={t} label={owner ? "광고비(VAT포함)" : "쓴 광고비 (부가세 포함)"} value={won(view.costVat)} suffix="원" accent/></div>
              <MiniStat t={t} label={owner ? "클릭" : "광고 클릭"} value={won(view.sum.clicks)} suffix={owner ? "" : "명"}/>
              <MiniStat t={t} label="접수" value={won(view.leadTotal || view.sum.conv)}/>
              <MiniStat t={t} label={owner ? "클릭당 비용" : "클릭 1회 비용"} value={won(view.cpc)} suffix="원"/>
              <MiniStat t={t} label={owner ? "평균 순위" : "노출 순위"} value={view.rank != null ? view.rank.toFixed(1) : "-"} suffix="위"/>
            </div>
            <StatusBoard t={t} isPc={isPc} data={data} view={view} owner={owner}/>
          </Card>
          {!owner && <ClientSummary t={t} adv={adv} data={data} view={view} since={since} until={until}/>}
          {!owner && <CareCard t={t} isPc={isPc} data={data} view={view}/>}

          <div style={{ display: "grid", gridTemplateColumns: isPc ? "1fr 1fr" : "1fr", gap: 12 }}>
            <Card t={t} title="일별 흐름 · 접수 입력" sub={owner ? "접수 칸에 그날 전화·문의 건수를 넣으면 접수당 광고비가 계산됩니다" : "오른쪽 분홍 칸(✎)에 그날 받은 전화·문의 건수를 넣어 주세요 — 입력 즉시 접수당 광고비가 계산됩니다"}>
              {view.days.length === 0 ? <Empty t={t}>집계된 날이 없습니다</Empty> : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 52px 44px 64px", gap: 6, fontSize: 9.5, color: t.textMuted, fontWeight: 700, padding: "0 0 4px" }}>
                    <span>날짜</span><span>광고비</span><span>클릭</span><span>순위</span><span style={{ color: t.accent }}>접수 ✎ 입력</span>
                  </div>
                  {view.days.map(d => (
                    <DayRow key={d.ymd} t={t} d={d} lead={(data.leads || {})[d.ymd]} onSave={saveLead}/>
                  ))}
                </>
              )}
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card t={t} title="캠페인별">
                {view.camps.length === 0 ? <Empty t={t}>캠페인 없음</Empty> : view.camps.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${t.border}`, fontSize: 12 }}>
                    <span style={{ flex: 1, fontWeight: 700, color: c.userLock ? t.textMuted : t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}{c.userLock ? " (중지)" : ""}{c.type && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: t.textMuted, background: `${t.textMuted}1F`, borderRadius: 999, padding: "1px 7px" }}>{c.type}</span>}</span>
                    <span className="mono" style={{ color: t.textMuted }}>{won(Math.round(c.cost * 1.1))}원</span>
                    <span className="mono" style={{ color: t.textMuted }}>{c.clicks}클릭</span>
                    <span className="mono" style={{ color: t.textMuted }}>{c.rank ? `${c.rank}위` : "-"}</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
          </>}
          {section === "autobid" && owner && <AutobidCard t={t} isPc={isPc} adv={adv} actor={actor} actorName={actorName} onChanged={() => setTick(x => x + 1)}/>}
          {section === "shield" && owner && <ShieldCard t={t} adv={adv} actor={actor} actorName={actorName} view={view} onChanged={() => setTick(x => x + 1)}/>}
          {section === "keywords" && (owner || adv.show_keywords) && <KeywordTable t={t} isPc={isPc} adv={adv} actor={actor} actorName={actorName} owner={owner} since={since} until={until} onChanged={() => setTick(x => x + 1)}/>}
          {section === "report" && owner && <ReportLauncher t={t} adv={adv} since={since} until={until}/>}
          {section === "log" && <>
            <ChangeLog t={t} logs={view.logs} owner={owner} adv={adv} actor={actor} actorName={actorName} onAdded={() => setTick(x => x + 1)}/>
            {owner && <ShareBar t={t} adv={adv} actor={actor}/>}
          </>}
        </>
      )}
    </>
  );
}

// ---------- 키워드 표 (2단계) ----------
function KeywordTable({ t, isPc, adv, actor, actorName, owner, since, until, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const load = useCallback((fresh) => {
    if (!owner) return; // 광고주 화면은 운영자 캐시만 읽지 않음 — 2단계 후반에 토큰 조회 추가
    setLoading(true);
    api("keywords", { actor, get: { id: adv.id, since, until, ...(fresh ? { fresh: "1" } : {}) } })
      .then(j => { setData(j.ok ? j : null); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [owner, actor, adv.id, since, until]);
  useEffect(() => { load(false); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.keywords || [];
    if (q.trim()) r = r.filter(k => (k.keyword || "").includes(q.trim()) || (k.group || "").includes(q.trim()));
    else if (!showAll) r = r.filter(k => k.impressions > 0);
    return r.slice(0, showAll ? 300 : 40);
  }, [data, q, showAll]);

  const setBid = async (k, bid) => {
    const j = await api("setbid", { actor, post: { id: adv.id, keywordId: k.id, adgroupId: k.groupId, bid, keyword: k.keyword, prevBid: k.bid, actor_name: actorName } });
    if (j.ok) { setData(d => d ? { ...d, keywords: d.keywords.map(x => x.id === k.id ? { ...x, bid, useGroupBid: false } : x) } : d); onChanged(); }
    else window.alert(j.error || "변경 실패");
  };
  const toggleLock = async (k) => {
    const lock = !k.lock;
    if (!window.confirm(`${k.keyword} ${lock ? "중지" : "재개"}할까요?`)) return;
    const j = await api("lockkw", { actor, post: { id: adv.id, keywordId: k.id, adgroupId: k.groupId, lock, keyword: k.keyword, actor_name: actorName } });
    if (j.ok) { setData(d => d ? { ...d, keywords: d.keywords.map(x => x.id === k.id ? { ...x, lock } : x) } : d); onChanged(); }
    else window.alert(j.error || "변경 실패");
  };
  if (!owner) return null;

  const cols = isPc ? "minmax(120px,1.4fr) 90px 56px 48px 46px 44px 76px 70px 40px" : "minmax(90px,1.4fr) 50px 44px 40px 70px 60px 34px";
  return (
    <Card t={t} title="키워드 · 입찰" sub={data ? `${data.exposed}개 노출 / 전체 ${data.total}개 · ${data.cached ? "캐시" : "실시간"} ${String(data.fetched_at || "").slice(11, 16)} · 1위 예상가는 모바일 기준` : "네이버에서 키워드 성과를 받는 중 (수천 개면 20초)"}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input className="mkt-input" placeholder="키워드·그룹 검색" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle(t), padding: "7px 10px" }}/>
        <button onClick={() => setShowAll(v => !v)} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto", padding: "7px 10px" }}>{showAll ? "노출만" : "전체"}</button>
        <button onClick={() => load(true)} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto", padding: "7px 10px" }} disabled={loading}>{loading ? "…" : "새로"}</button>
      </div>
      {!data && !loading && <Empty t={t}>불러오지 못했습니다 — "새로" 눌러 다시</Empty>}
      {data && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, fontSize: 9.5, color: t.textMuted, fontWeight: 700, padding: "0 0 4px", minWidth: isPc ? 0 : 430 }}>
            <span>키워드</span>{isPc && <span>그룹</span>}<span>노출</span><span>클릭</span>{isPc && <span>CTR</span>}<span>순위</span><span>입찰가</span><span>1위 예상</span><span></span>
          </div>
          {rows.length === 0 ? <Empty t={t}>해당 키워드 없음</Empty> : rows.map(k => (
            <KwRow key={k.id} t={t} isPc={isPc} k={k} cols={cols} onBid={setBid} onLock={toggleLock}/>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------- 관리자 메인: 전체 현황 ----------
// 광고주별 오늘 한 줄. 급한 곳(경보 있는 곳)이 위로. 클릭하면 그 광고주로.
function Overview({ t, isPc, actor, onPick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); api("overview", { actor }).then(j => { setData(j.ok ? j : null); setLoading(false); }).catch(() => { setData(null); setLoading(false); }); }, [actor]);
  useEffect(() => { load(); const iv = setInterval(load, 5 * 60 * 1000); return () => clearInterval(iv); }, [load]);
  const rows = useMemo(() => {
    if (!data) return [];
    return (data.advertisers || []).map(a => {
      const alerts = [];
      if (!a.ok) alerts.push({ lv: "danger", text: "네이버 연결 실패" });
      else {
        if (a.bizmoney != null && (a.bizmoney <= 50000 || (a.bizDays != null && a.bizDays < 1))) alerts.push({ lv: "danger", text: `광고비 ${won(Math.round(a.bizmoney))}원 — 충전` });
        else if (a.bizDays != null && a.bizDays < 3) alerts.push({ lv: "warning", text: `광고비 ${a.bizDays.toFixed(1)}일분` });
        if (a.yday.clicks >= 8 && a.today.clicks >= 20 && a.today.clicks / a.yday.clicks >= 2.5) alerts.push({ lv: "danger", text: `클릭 급증 ${a.today.clicks}` });
        if (a.autobid?.last?.error) alerts.push({ lv: "danger", text: "자동입찰 오류" });
        else if (a.autobid?.enabled && a.autobid.last && Date.now() - new Date(a.autobid.last.at).getTime() > 2 * 3600 * 1000) alerts.push({ lv: "warning", text: `자동입찰 ${fmtAgo(a.autobid.last.at)} 이후 멈춤` });
        if (a.cpa_limit && a.today.lead > 0 && a.today.costVat / a.today.lead > a.cpa_limit) alerts.push({ lv: "danger", text: "접수당 광고비 상한 초과" });
        if (a.today.costVat > 0 && a.today.lead == null) alerts.push({ lv: "info", text: "접수 미입력" });
        if (!a.cpa_limit) alerts.push({ lv: "info", text: "건당 이익 미설정" });
      }
      const score = alerts.reduce((n, x) => n + (x.lv === "danger" ? 100 : x.lv === "warning" ? 10 : 1), 0);
      return { ...a, alerts, score };
    }).sort((a, b) => b.score - a.score || b.today?.costVat - a.today?.costVat);
  }, [data]);
  const tot = rows.reduce((s, a) => a.ok ? { cost: s.cost + a.today.costVat, clicks: s.clicks + a.today.clicks, biz: s.biz + (a.bizmoney || 0), danger: s.danger + a.alerts.filter(x => x.lv === "danger").length } : s, { cost: 0, clicks: 0, biz: 0, danger: 0 });
  const lvColor = (lv) => lv === "danger" ? t.danger : lv === "warning" ? t.warning : t.textMuted;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>전체 현황</div>
          <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>{data?.until || kstYmd(0)} 오늘 · 광고주 {rows.length}곳 · 5분마다 갱신{loading ? " · 조회 중…" : ""}</div>
        </div>
        <button onClick={load} className="tab-btn" aria-label="새로고침" style={{ ...iconBtn(t), marginLeft: "auto", border: `1px solid ${t.border}`, borderRadius: 10, padding: 8 }}><RefreshCw size={14}/></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${isPc ? 4 : 2}, minmax(0, 1fr))`, gap: 8 }}>
        <MiniStat t={t} label="오늘 광고비 합계" value={won(tot.cost)} suffix="원" accent/>
        <MiniStat t={t} label="오늘 클릭 합계" value={won(tot.clicks)}/>
        <MiniStat t={t} label="잔액 합계" value={won(Math.round(tot.biz))} suffix="원"/>
        <MiniStat t={t} label="긴급 경보" value={String(tot.danger)} suffix="건" accent={tot.danger > 0}/>
      </div>
      {!data && !loading && <Card t={t} title="불러오지 못했습니다"><Empty t={t}>새로고침을 눌러 주세요</Empty></Card>}
      {!data && loading && <Card t={t} title="광고주별 현황"><Empty t={t}>네이버에서 광고주별 오늘 수치를 받는 중…</Empty></Card>}
      {rows.map(a => {
        const top = a.alerts[0];
        const border = top ? lvColor(top.lv) : t.border;
        return (
          <div key={a.id} onClick={() => onPick(a.id)} className="tab-btn" style={{ background: t.bgElevated, border: `1px solid ${border}${top && top.lv !== "info" ? "88" : ""}`, borderLeft: `4px solid ${top && top.lv !== "info" ? border : t.success}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 900 }}>{a.name}</span>
              <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>{a.campaign_filter ? `"${a.campaign_filter}"` : "전체 캠페인"}{a.ok ? ` · 캠페인 ${a.campaigns}개` : ""}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
                {a.alerts.length === 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: t.success, background: `${t.success}1F`, borderRadius: 999, padding: "2px 9px" }}>이상 없음</span>}
                {a.alerts.map((x, i) => <span key={i} style={{ fontSize: 10.5, fontWeight: 800, color: lvColor(x.lv), background: `${lvColor(x.lv)}1F`, borderRadius: 999, padding: "2px 9px" }}>{x.lv === "danger" ? "🚨 " : x.lv === "warning" ? "⚠ " : ""}{x.text}</span>)}
              </span>
            </div>
            {a.ok ? (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${isPc ? 6 : 3}, minmax(0, 1fr))`, gap: 6, marginTop: 10 }}>
                <OvStat t={t} label="오늘 광고비" value={`${won(a.today.costVat)}원`} sub={`어제 ${won(a.yday.costVat)}원`}/>
                <OvStat t={t} label="클릭" value={won(a.today.clicks)} sub={`어제 ${won(a.yday.clicks)}`}/>
                <OvStat t={t} label="순위" value={a.today.rank != null ? `${a.today.rank.toFixed(1)}위` : "-"}/>
                <OvStat t={t} label="접수" value={a.today.lead != null ? `${a.today.lead}건` : "미입력"} sub={a.today.lead > 0 ? `${won(Math.round(a.today.costVat / a.today.lead))}원/건` : ""}/>
                <OvStat t={t} label="잔액" value={a.bizmoney != null ? `${won(Math.round(a.bizmoney))}원` : "-"} sub={a.bizDays != null ? `약 ${a.bizDays.toFixed(1)}일분` : ""} color={a.bizmoney != null && a.bizmoney <= 50000 ? t.danger : a.bizDays != null && a.bizDays < 3 ? t.warning : undefined}/>
                <OvStat t={t} label="자동입찰" value={!a.autobid?.enabled ? "꺼짐" : a.autobid.last ? fmtAgo(a.autobid.last.at) : "대기"} sub={a.autobid?.enabled ? `${a.autobid.groups}그룹${a.ips ? ` · IP ${a.ips.total}` : ""}` : (a.ips ? `IP 차단 ${a.ips.total}` : "")}/>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 11.5, color: t.danger }}>{a.error}</div>
            )}
          </div>
        );
      })}
    </>
  );
}
function OvStat({ t, label, value, sub, color }) {
  return (
    <div style={{ background: t.bgInset, borderRadius: 8, padding: "7px 9px", minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 700 }}>{label}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 900, color: color || t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}

// ---------- 보고서 (운영자) ----------
// /mkt/report/<광고주id>?since&until 를 새 탭으로 열어 A4 한 장 사무 양식으로 렌더 → 브라우저 인쇄(PDF 저장).
// 서버에서 PDF 를 만들지 않는 이유: Vercel Hobby 함수 12개 한도 + 크로미움 용량. 브라우저 인쇄가 같은 결과를 무료로 낸다.
function ReportLauncher({ t, adv, since, until }) {
  const [s, setS] = useState(kstYmd(-7));
  const [u, setU] = useState(kstYmd(-1));
  const open = () => window.open(`/mkt/report/${adv.id}?since=${s}&until=${u}`, "_blank");
  const preset = (a, b) => { setS(a); setU(b); };
  return (
    <Card t={t} title="운영 보고서 (A4 1장)" sub="기간을 고르고 열면 사무 양식으로 정리된 보고서가 새 창에 뜹니다. 인쇄 → 'PDF로 저장'">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button onClick={() => preset(kstYmd(-7), kstYmd(-1))} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto", padding: "6px 10px" }}>지난 7일</button>
        <button onClick={() => preset(kstYmd(-14), kstYmd(-1))} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto", padding: "6px 10px" }}>지난 14일</button>
        <button onClick={() => preset(kstYmd(0).slice(0, 8) + "01", kstYmd(0))} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto", padding: "6px 10px" }}>이번 달</button>
        <button onClick={() => preset(since, until)} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto", padding: "6px 10px" }}>화면 기간</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" value={s} onChange={e => setS(e.target.value)} className="mkt-input" style={{ ...inputStyle(t), width: 150 }}/>
        <span style={{ color: t.textMuted }}>~</span>
        <input type="date" value={u} onChange={e => setU(e.target.value)} className="mkt-input" style={{ ...inputStyle(t), width: 150 }}/>
        <button onClick={open} className="tab-btn" style={{ ...btnPrimary(t) }}><ExternalLink size={13}/> 보고서 열기</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
        보고서 안의 '비고'·'다음 계획'·'담당자 의견' 칸은 클릭해서 바로 고칠 수 있고, 같은 광고주·기간이면 이 PC 에 기억됩니다. 입찰가는 원칙대로 들어가지 않습니다.
      </div>
    </Card>
  );
}
const RPT_CSS = `
  @page { size: A4; margin: 10mm 12mm; }
  .rpt { max-width: 800px; margin: 0 auto; background: #fff; color: #111; font-family: "Noto Sans CJK KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif; font-size: 9.5pt; line-height: 1.35; padding: 24px 28px; }
  .rpt h1 { font-size: 16pt; margin: 0; text-align: center; padding: 6px 0 8px; border-bottom: 2px solid #111; letter-spacing: .02em; }
  .rpt table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  .rpt table.info { margin: 6px 0 8px; font-size: 8.5pt; }
  .rpt table.info th { background: #f2f2f2; font-weight: 600; width: 11%; text-align: center; border: 1px solid #999; padding: 4px; }
  .rpt table.info td { border: 1px solid #999; padding: 4px 6px; width: 22%; }
  .rpt h2 { font-size: 10pt; margin: 8px 0 3px; padding-left: 6px; border-left: 4px solid #111; }
  .rpt table.t { font-size: 8.5pt; }
  .rpt table.t th { background: #f2f2f2; border: 1px solid #999; padding: 3px 5px; font-weight: 600; text-align: center; white-space: nowrap; }
  .rpt table.t td { border: 1px solid #999; padding: 2px 5px; }
  .rpt td.n { text-align: right; white-space: nowrap; } .rpt td.c { text-align: center; white-space: nowrap; }
  .rpt tr.sum td { font-weight: 600; background: #fafafa; }
  .rpt .hl { background: #fff27a; }
  .rpt .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .rpt .ed { min-height: 54px; border: 1px dashed #bbb; padding: 4px 6px; outline: none; white-space: pre-wrap; }
  .rpt .ed:focus { border-color: #E91860; background: #fff9fb; }
  .rpt .ed:empty:before { content: attr(data-ph); color: #999; }
  .rpt table.sign { margin-top: 10px; font-size: 9pt; }
  .rpt table.sign th { background: #f2f2f2; border: 1px solid #999; padding: 3px; font-weight: 600; text-align: center; }
  .rpt table.sign td { border: 1px solid #999; height: 30px; width: 25%; }
  .rpt .foot { font-size: 8pt; color: #555; margin-top: 6px; }
  .rpt-bar { position: sticky; top: 0; background: #1A1512; color: #fff; padding: 10px 16px; display: flex; gap: 8px; align-items: center; font-family: inherit; font-size: 13px; z-index: 5; }
  .rpt-bar button { background: #E91860; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 800; cursor: pointer; font-family: inherit; }
  @media print { .rpt-bar { display: none !important; } body { background: #fff !important; } .rpt { padding: 0; max-width: none; } .rpt .ed { border: none; padding: 0; } .rpt .ed:empty:before { content: ""; } }
`;
function Editable({ k, ph, store, setStore }) {
  return <div className="ed" contentEditable suppressContentEditableWarning data-ph={ph} onBlur={e => setStore(st => ({ ...st, [k]: e.currentTarget.innerText }))} dangerouslySetInnerHTML={{ __html: (store[k] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>") }}/>;
}
function ReportView({ advId, user }) {
  const actor = user?.user_id || user?.userId || user?.id;
  const q = new URLSearchParams(window.location.search);
  const since = /^\d{4}-\d{2}-\d{2}$/.test(q.get("since") || "") ? q.get("since") : kstYmd(-7);
  const until = /^\d{4}-\d{2}-\d{2}$/.test(q.get("until") || "") ? q.get("until") : kstYmd(-1);
  const [st, setSt] = useState(null);
  const [kw, setKw] = useState(null);
  const [err, setErr] = useState(null);
  const storeKey = `mkt_rpt_${advId}_${since}_${until}`;
  const [store, setStore] = useState(() => { try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(store)); } catch { /* */ } }, [store, storeKey]);
  useEffect(() => {
    api("stats", { actor, get: { id: advId, since, until } }).then(j => j.ok ? setSt(j) : setErr(j.error || "조회 실패")).catch(e => setErr(String(e)));
    api("keywords", { actor, get: { id: advId, since, until } }).then(j => setKw(j.ok ? j : { keywords: [] })).catch(() => setKw({ keywords: [] }));
  }, [actor, advId, since, until]);

  const today = kstYmd(0);
  if (err) return <div style={{ padding: 40, fontFamily: "sans-serif" }}>보고서를 만들 수 없습니다 — {err}</div>;
  if (!st) return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#666" }}>네이버에서 {since} ~ {until} 성과를 받는 중…</div>;
  const adv = st.advertiser;
  const days = (st.days || []).slice().sort((a, b) => a.ymd < b.ymd ? -1 : 1);
  const leads = st.leads || {};
  const tot = days.reduce((a, d) => ({ imp: a.imp + d.impressions, clk: a.clk + d.clicks, cost: a.cost + d.cost, lead: a.lead + Number(leads[d.ymd]?.leads || 0) }), { imp: 0, clk: 0, cost: 0, lead: 0 });
  const bestClk = Math.max(...days.map(d => d.clicks), 0);
  const camps = (st.campaigns || []);
  const kws = (kw?.keywords || []).filter(k => k.impressions > 0).slice(0, 12);
  const bestCtr = Math.max(...kws.filter(k => k.clicks >= 3).map(k => k.ctr), 0);
  const acts = (st.logs || []).filter(l => l.at.slice(0, 10) >= since && l.at.slice(0, 10) <= until && l.visible_to_client !== false && l.actor !== "자동입찰")
    .map(l => ({ ymd: l.at.slice(5, 10), action: l.action, detail: (l.detail || "").replace(/[\d,]+원\s*→\s*/g, "").replace(/\s*[·]?\s*(상한|바닥|입찰가?)\s*[\d,]+원/g, "").replace(/[\d,]+원/g, "").replace(/\(\s*\)/g, "").trim() })).slice(0, 8);
  const autoRuns = (st.logs || []).filter(l => l.actor === "자동입찰" && l.at.slice(0, 10) >= since && l.at.slice(0, 10) <= until).length;
  const per = tot.lead > 0 ? Math.round(tot.cost * 1.1 / tot.lead) : null;
  const ctr = (c, i) => i ? (c / i * 100).toFixed(2) + "%" : "-";
  const cpc = (c, k) => k ? won(Math.round(c / k)) : "-";
  const wd = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div style={{ background: "#e9e9e9", minHeight: "100vh" }}>
      <style>{RPT_CSS}</style>
      <div className="rpt-bar">
        <span style={{ flex: 1 }}>📄 {adv.name} 운영 보고서 · {since} ~ {until} — 점선 칸은 클릭해서 수정</span>
        <button onClick={() => window.print()}>인쇄 / PDF 저장</button>
      </div>
      <div className="rpt">
        <h1>네이버 파워링크 광고 운영 보고서</h1>
        <table className="info"><tbody>
          <tr><th>광고주</th><td>{adv.name}</td><th>캠페인</th><td>{camps.map(c => c.name).join(", ") || "-"} (계정 {adv.customer_id})</td></tr>
          <tr><th>보고 기간</th><td>{since} ~ {until} ({days.length}일)</td><th>작성일</th><td>{today}</td></tr>
          <tr><th>보고 구분</th><td>{days.length >= 7 ? "주간 운영 보고" : "운영 보고"}</td><th>데이터 출처</th><td>네이버 검색광고 API · 광고비 VAT 별도</td></tr>
        </tbody></table>

        <h2>1. 기간 요약</h2>
        <table className="t"><tbody>
          <tr><th>노출</th><th>클릭</th><th>클릭률</th><th>광고비(VAT별도)</th><th>광고비(VAT포함)</th><th>클릭당 비용</th><th>접수</th><th>접수당 광고비</th><th>평균 순위</th></tr>
          <tr><td className="n">{won(tot.imp)}</td><td className="n">{won(tot.clk)}</td><td className="n">{ctr(tot.clk, tot.imp)}</td><td className="n">{won(tot.cost)}</td><td className="n hl">{won(Math.round(tot.cost * 1.1))}</td><td className="n">{cpc(tot.cost, tot.clk)}</td><td className="n">{tot.lead ? won(tot.lead) : "미입력"}</td><td className={"n" + (per != null ? " hl" : "")}>{per != null ? won(per) : "-"}</td><td className="n">{st.totals?.rank != null ? st.totals.rank.toFixed(1) : "-"}</td></tr>
        </tbody></table>

        <h2>2. 일별 성과</h2>
        <table className="t"><tbody>
          <tr><th>일자</th><th>요일</th><th>노출</th><th>클릭</th><th>클릭률</th><th>광고비</th><th>클릭당 비용</th><th>평균 순위</th><th>접수</th></tr>
          {days.map(d => (
            <tr key={d.ymd}><td className="c">{d.ymd.slice(5)}</td><td className="c">{wd[new Date(d.ymd + "T00:00:00").getDay()]}</td><td className="n">{won(d.impressions)}</td><td className={"n" + (d.clicks === bestClk && bestClk > 0 ? " hl" : "")}>{won(d.clicks)}</td><td className="n">{ctr(d.clicks, d.impressions)}</td><td className="n">{won(d.cost)}</td><td className="n">{cpc(d.cost, d.clicks)}</td><td className="n">{d.rank != null ? d.rank.toFixed(1) : "-"}</td><td className="n">{leads[d.ymd]?.leads ?? ""}</td></tr>
          ))}
          <tr className="sum"><td className="c" colSpan={2}>합계</td><td className="n">{won(tot.imp)}</td><td className="n">{won(tot.clk)}</td><td className="n">{ctr(tot.clk, tot.imp)}</td><td className="n">{won(tot.cost)}</td><td className="n">{cpc(tot.cost, tot.clk)}</td><td className="n">{st.totals?.rank != null ? st.totals.rank.toFixed(1) : "-"}</td><td className="n">{tot.lead || ""}</td></tr>
        </tbody></table>

        {camps.length > 1 && (<>
          <h2>3. 캠페인별</h2>
          <table className="t"><tbody>
            <tr><th>캠페인</th><th>노출</th><th>클릭</th><th>클릭률</th><th>광고비</th><th>순위</th><th>상태</th></tr>
            {camps.map(c => <tr key={c.id}><td>{c.name}{c.type ? ` (${c.type})` : ""}</td><td className="n">{won(c.impressions)}</td><td className="n">{won(c.clicks)}</td><td className="n">{ctr(c.clicks, c.impressions)}</td><td className="n">{won(c.cost)}</td><td className="n">{c.rank != null ? c.rank.toFixed(1) : "-"}</td><td className="c">{c.userLock ? "중지" : "운영"}</td></tr>)}
          </tbody></table>
        </>)}

        <h2>{camps.length > 1 ? 4 : 3}. 주요 키워드 (광고비 상위)</h2>
        <table className="t"><tbody>
          <tr><th>키워드</th><th>그룹</th><th>노출</th><th>클릭</th><th>클릭률</th><th>광고비</th><th>클릭당 비용</th><th>순위</th></tr>
          {kws.length === 0 ? <tr><td colSpan={8} className="c">집계 중</td></tr> : kws.map(k => (
            <tr key={k.id}><td>{k.keyword}</td><td>{(k.group || "").replace(/^파워링크_/, "")}</td><td className="n">{won(k.impressions)}</td><td className="n">{won(k.clicks)}</td><td className={"n" + (k.clicks >= 3 && k.ctr === bestCtr ? " hl" : "")}>{k.ctr}%</td><td className="n">{won(k.cost)}</td><td className="n">{won(k.cpc)}</td><td className="n">{k.rank != null ? Number(k.rank).toFixed(1) : "-"}</td></tr>
          ))}
        </tbody></table>

        <h2>{camps.length > 1 ? 5 : 4}. 적용 조치</h2>
        <table className="t"><tbody>
          <tr><th>일자</th><th>구분</th><th>내용</th></tr>
          {acts.length === 0 ? <tr><td colSpan={3} className="c">기간 내 수동 조치 없음</td></tr> : acts.map((a, i) => <tr key={i}><td className="c">{a.ymd}</td><td className="c">{a.action}</td><td>{a.detail}</td></tr>)}
          {autoRuns > 0 && <tr><td className="c">상시</td><td className="c">자동입찰</td><td className="hl">30분 간격 순위 점검 · 기간 중 {won(autoRuns)}회 입찰 조정 — 목표 순위 유지</td></tr>}
        </tbody></table>

        <div className="two" style={{ marginTop: 8 }}>
          <div><h2>다음 기간 계획</h2><Editable k="plan" ph="예) 상위 클릭 키워드 1위 유지 · 클릭 0 키워드 정리 · 소재 교체" store={store} setStore={setStore}/></div>
          <div><h2>담당자 의견</h2><Editable k="memo" ph="예) 클릭률 상승 추세. 접수 건수 입력 시 접수당 광고비 판정 가능" store={store} setStore={setStore}/></div>
        </div>
        <table className="sign"><tbody><tr><th>작성</th><th>검토</th><th>광고주 확인</th><th>비고</th></tr><tr><td/><td/><td/><td/></tr></tbody></table>
        <div className="foot">올잇 마케팅 · 본 보고서의 수치는 네이버 검색광고 API 집계 기준이며, 당일 수치는 조회 시점까지입니다.</div>
      </div>
    </div>
  );
}

// ---------- 상태 보드 (성과 카드 하단 4칸) ----------
// 비즈머니 / 클릭 감시 / IP 차단 / 자동입찰 — 문장 대신 색 배지 + 게이지.
function StatusTile({ t, icon, title, value, badge, color, sub, bar, wrap }) {
  return (
    <div style={{ background: t.bgInset, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: t.textMuted, fontWeight: 700 }}>
        <span>{icon}</span><span style={{ flex: 1 }}>{title}</span>
        {badge && <span style={{ fontSize: 9.5, fontWeight: 800, color, background: `${color}22`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{badge}</span>}
      </div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {bar != null && (
        <div style={{ height: 5, borderRadius: 999, background: t.borderStrong, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(3, Math.min(100, bar))}%`, height: "100%", background: color, borderRadius: 999, transition: "width .3s" }}/>
        </div>
      )}
      {sub && <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, lineHeight: 1.4, ...(wrap ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>{sub}</div>}
    </div>
  );
}
function StatusBoard({ t, isPc, data, view, owner }) {
  const tiles = [];
  if (view.biz != null) {
    const d = view.bizDays;
    const color = view.bizLow ? t.danger : d == null ? t.textMuted : d < 3 ? t.warning : t.success;
    tiles.push({ icon: "💰", title: owner ? "광고비 잔액" : "남은 광고비", value: `${won(Math.round(view.biz))}원`, color,
      badge: view.bizLow ? "충전 필요" : d == null ? "집계 대기" : d < 3 ? "여유 적음" : "충분",
      bar: d == null ? null : (d / 14) * 100, sub: d != null ? `하루 평균 ${won(view.avgDay)}원 씀 · 약 ${d.toFixed(1)}일분` : "하루 평균 지출 집계 후 표시" });
  }
  {
    const ratio = view.avgClicks > 0 ? view.todayClicks / view.avgClicks : 0;
    const color = view.clickAlert ? t.danger : t.success;
    tiles.push({ icon: "🛡", title: "클릭 감시", value: `오늘 ${won(view.todayClicks)}클릭`, color,
      badge: view.clickAlert ? `급증 ${ratio.toFixed(1)}배` : "정상", bar: view.avgClicks > 0 ? (ratio / 2.5) * 100 : 0,
      sub: view.avgClicks > 0 ? (owner ? `직전 7일 평균 ${won(view.avgClicks)}클릭 · 2.5배 넘으면 경보` : `평소 하루 ${won(view.avgClicks)}클릭 · 갑자기 늘면 경보`) : "비교할 이전 데이터 없음" });
  }
  if (data.ips) {
    const color = data.ips.new24h ? t.warning : t.success;
    tiles.push({ icon: "🚫", title: owner ? "IP 차단" : "부정클릭 차단", value: `${won(data.ips.total)}개`, color,
      badge: data.ips.new24h ? `24시간 +${data.ips.new24h}` : "보호 중", bar: (data.ips.total / data.ips.limit) * 100,
      sub: owner ? (data.ips.mobile ? `모바일 공용대역 ${data.ips.mobile}개 주의 · 한도 ${data.ips.limit}` : `차단 IP 에는 광고 미노출 · 한도 ${data.ips.limit}개`) : "차단된 곳에는 광고가 안 보입니다" });
  }
  {
    const ab = data.autobid, last = ab?.last, care = data.care || {};
    const stale = last && Date.now() - new Date(last.at).getTime() > 2 * 3600 * 1000;
    const color = !ab?.enabled ? t.textMuted : last?.error ? t.danger : stale ? t.warning : last ? t.success : t.warning;
    tiles.push({ icon: "🤖", title: "자동입찰", color,
      value: !ab?.enabled ? "꺼짐" : last ? `${fmtAgo(last.at)} 점검` : `${ab.groups}개 그룹 대기`,
      badge: !ab?.enabled ? "미사용" : last?.error ? "오류" : stale ? "지연" : last ? "가동 중" : "첫 실행 전",
      bar: ab?.enabled ? (last ? 100 : 30) : 0,
      sub: !ab?.enabled ? (owner ? "자동입찰 메뉴에서 그룹을 켜세요" : "담당자 설정 전") : last?.error ? last.error.slice(0, 50)
        : last ? `오늘 ${won(care.checks_today || 0)}회 점검 · ${care.adjusted_today ? `${won(care.adjusted_today)}건 조정` : "조정 불필요"} · ${owner ? "감시" : "관리 중"} ${won(last.alive)}개` : `${ab.groups}개 그룹 · 30분 간격` });
  }
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`, display: "grid", gridTemplateColumns: `repeat(${isPc ? 4 : 2}, minmax(0, 1fr))`, gap: 8 }}>
      {tiles.map((x, i) => <StatusTile key={i} t={t} wrap={!isPc} {...x}/>)}
    </div>
  );
}

// ---------- 광고주 화면: 오늘의 요약 (문장) ----------
// 숫자 카드만 보면 함축적이라, 같은 수치를 문장으로 풀어 준다. 금액·키워드 원칙은 동일 (입찰가 없음).
// [[...]] 로 감싼 부분은 형광펜
function hlText(str, t) {
  return String(str).split(/(\[\[.*?\]\])/g).map((seg, i) => seg.startsWith("[[") && seg.endsWith("]]")
    ? <mark key={i} style={{ background: t.bg === "#1A1512" ? "rgba(255,242,122,0.28)" : "#fff27a", color: t.text, fontWeight: 800, padding: "0 3px", borderRadius: 3 }}>{seg.slice(2, -2)}</mark>
    : seg);
}
function ClientSummary({ t, adv, data, view, since, until }) {
  const c = data.care || {};
  const rows = [];
  const per = view.isToday ? "오늘 결과" : "기간 결과";
  rows.push({ label: per, text: view.sum.clicks > 0
    ? `광고비 [[${won(view.costVat)}원]] · [[${won(view.sum.clicks)}명]] 클릭 · ${view.rank != null ? `[[${view.rank.toFixed(1)}위]] 노출` : "순위 집계 중"}`
    : "아직 집계된 클릭 없음 (네이버 집계 1~2시간 지연)" });
  if (view.leadTotal > 0 && view.per != null) {
    const j = adv.cpa_limit ? (view.per <= (adv.cpa_good || 0) ? "매우 좋음" : view.per <= adv.cpa_limit ? "적정" : "기준 초과 · 조정 중") : null;
    rows.push({ label: "접수 효율", text: `접수 ${won(view.leadTotal)}건 · 1건당 [[${won(view.per)}원]]${j ? ` → [[${j}]]` : ""}` });
  }
  const todo = [];
  if (view.bizLow) todo.push(`광고비 [[${won(Math.round(view.biz))}원]] 남음 → [[충전]]`);
  if (view.costVat > 0 && !view.leadTotal) todo.push("아래 분홍 칸에 [[접수 건수 입력]]");
  if (todo.length) rows.push({ label: "해주실 일", text: todo.join("  /  "), accent: true });
  const did = [];
  if (c.adjusted_today) did.push(`자동입찰 [[${won(c.adjusted_today)}건]] 조정`);
  else if (c.checks_today) did.push(`${won(c.checks_today)}회 점검 · 조정 불필요`);
  if (view.rank != null && view.rank <= 2) did.push("목표 순위 유지 중");
  if (view.clickAlert) did.push("[[클릭 급증]] 확인 중");
  if (c.ops_week) did.push(`이번 주 담당자 작업 ${won(c.ops_week)}건`);
  if (did.length) rows.push({ label: "저희가 한 일", text: did.join(" · ") });
  if (view.isToday && view.yRow) rows.push({ label: "어제", text: `${won(Math.round(view.yRow.cost * 1.1))}원 · ${won(view.yRow.clicks)}명 클릭${view.yRow.rank ? ` · ${view.yRow.rank.toFixed(1)}위` : ""}` });
  return (
    <Card t={t} title="한눈에 보기">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: i ? `1px solid ${t.border}` : "none" }}>
            <span style={{ flex: "0 0 74px", fontSize: 12, fontWeight: 800, color: r.accent ? t.accent : t.textMuted, paddingTop: 1 }}>{r.label}</span>
            <span style={{ flex: 1, fontSize: 14, lineHeight: 1.55, color: t.text, fontWeight: 600 }}>{hlText(r.text, t)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- 광고주 화면: 실시간 관리 현황 ----------
// 금액·키워드 없이 활동량만. "조정 0건" 대신 점검 횟수를 앞세운다.
function CareCard({ t, isPc, data, view }) {
  const c = data.care || {};
  const live = c.last_check && Date.now() - new Date(c.last_check).getTime() < 45 * 60 * 1000;
  return (
    <Card t={t} title="관리 활동" sub={`30분마다 순위를 점검하고 필요할 때만 조정합니다${view.rank != null && view.rank <= 2 ? " · 목표 순위 유지 중" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, fontWeight: 800 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: live ? t.success : t.textMuted, boxShadow: live ? `0 0 0 4px ${t.success}33` : "none" }}/>
        {c.last_check ? `마지막 점검 ${fmtAgo(c.last_check)}` : "오늘 첫 자동 점검 대기 중"}
        <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted, fontWeight: 700 }}>30분 간격 자동 점검</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${isPc ? 4 : 2}, minmax(0, 1fr))`, gap: 8 }}>
        {c.checks_today ? (
          <>
            <MiniStat t={t} label="오늘 점검" value={won(c.checks_today)} suffix="회" accent/>
            <MiniStat t={t} label="오늘 입찰 조정" value={c.adjusted_today ? won(c.adjusted_today) : "불필요"} suffix={c.adjusted_today ? "건" : ""}/>
            <MiniStat t={t} label="관리 중인 키워드" value={won(c.watched || 0)} suffix="개"/>
          </>
        ) : (
          <>
            <MiniStat t={t} label="오늘 점검" value="대기" accent/>
            <MiniStat t={t} label="오늘 입찰 조정" value="대기"/>
            <MiniStat t={t} label="자동 점검 그룹" value={won(data.autobid?.groups || 0)} suffix="개"/>
          </>
        )}
        <MiniStat t={t} label="이번 주 담당자 작업" value={c.ops_week ? won(c.ops_week) : "집계 중"} suffix={c.ops_week ? "건" : ""}/>
      </div>
    </Card>
  );
}

// ---------- 부정클릭 (노출제한 IP) ----------
// 쿨가이처럼 블로그 착지면 IP 를 우리가 수집할 수 없다 → 네이버 광고시스템 '무효클릭 보고서' 에서 IP 를 보고 여기 수동 등록.
function ShieldCard({ t, adv, actor, actorName, view, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ips, setIps] = useState("");
  const [memo, setMemo] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => {
    setLoading(true);
    api("ips", { actor, get: { id: adv.id } }).then(j => { setData(j.ok ? j : null); setLoading(false); }).catch(() => { setData(null); setLoading(false); });
  }, [actor, adv.id]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!ips.trim()) return;
    setBusy(true); setMsg(null);
    const j = await api("ip_add", { actor, post: { id: adv.id, ips, memo, force, actor_name: actorName } });
    setBusy(false);
    if (j.ok || (j.results || []).some(r => r.ok)) {
      const okN = (j.results || []).filter(r => r.ok && !r.dup).length, dupN = (j.results || []).filter(r => r.dup).length;
      setMsg({ ok: true, text: `${okN}개 등록${dupN ? ` · 이미 있음 ${dupN}` : ""}${j.skippedMobile?.length ? ` · 모바일 대역 건너뜀 ${j.skippedMobile.length}` : ""}` });
      setIps(""); setMemo(""); setForce(false); load(); onChanged();
    } else setMsg({ ok: false, text: j.error || "등록 실패" });
  };
  const del = async (row) => {
    if (!window.confirm(`${row.ip} 차단을 해제할까요?`)) return;
    const j = await api("ip_del", { actor, post: { id: adv.id, ids: [row.id], actor_name: actorName } });
    if (j.ok) { load(); onChanged(); } else window.alert(j.error || "해제 실패");
  };
  const list = data?.list || [];
  return (
    <>
      <Card t={t} title="클릭 감시" sub="오늘 클릭이 직전 7일 평균의 2.5배 이상(20클릭 이상)이면 경보">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <MiniStat t={t} label="오늘 클릭" value={won(view?.todayClicks || 0)} accent={!!view?.clickAlert}/>
          <MiniStat t={t} label="직전 평균" value={won(view?.avgClicks || 0)}/>
          <MiniStat t={t} label="차단 IP" value={data ? `${data.total}` : "-"} suffix={data ? `/${data.limit}` : ""}/>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
          IP 는 광고시스템 → 도구 → <b>무효클릭 관리</b> 에서 확인합니다. 착지가 블로그라 여기서 방문자 IP 를 직접 잡지는 못합니다.
        </div>
      </Card>
      <Card t={t} title="노출제한 IP 등록" sub="등록된 IP 에는 이 계정의 광고가 아예 안 보입니다 (계정당 600개)">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea className="mkt-input" rows={2} placeholder={"IP 여러 개는 쉼표·줄바꿈으로\n예) 1.2.3.4, 5.6.7.8"} value={ips} onChange={e => setIps(e.target.value)} style={{ ...inputStyle(t), resize: "vertical", fontFamily: "inherit" }}/>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input className="mkt-input" placeholder="메모 (예: 무효클릭 보고서 9/16)" value={memo} onChange={e => setMemo(e.target.value)} style={{ ...inputStyle(t), flex: 1, minWidth: 160, padding: "7px 10px" }}/>
            <label style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)}/>모바일 대역도 강제</label>
            <button onClick={add} className="tab-btn" style={{ ...btnPrimary(t), padding: "8px 14px" }} disabled={busy || !ips.trim()}>{busy ? "등록 중…" : "차단 등록"}</button>
          </div>
          {msg && <div style={{ fontSize: 11.5, fontWeight: 700, color: msg.ok ? t.success : t.danger }}>{msg.text}</div>}
        </div>
        <div style={{ marginTop: 10, borderTop: `1px solid ${t.border}` }}>
          {loading && !data ? <Empty t={t}>불러오는 중…</Empty> : list.length === 0 ? <Empty t={t}>차단된 IP 없음</Empty> : list.slice(0, 100).map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
              <span className="mono" style={{ fontWeight: 700, color: r.mobile ? t.warning : t.text }}>{r.ip}</span>
              {r.mobile && <span style={{ fontSize: 9.5, color: t.warning, fontWeight: 800 }}>모바일 공용</span>}
              <span style={{ flex: 1, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.memo}</span>
              <span className="mono" style={{ color: t.textMuted, fontSize: 10.5 }}>{r.at ? fmtKst(new Date(r.at).toISOString()) : ""}</span>
              <button onClick={() => del(r)} className="tab-btn" style={{ ...iconBtn(t), fontSize: 11, fontWeight: 700 }}>해제</button>
            </div>
          ))}
          {list.length > 100 && <div style={{ fontSize: 10.5, color: t.textMuted, padding: 6 }}>외 {list.length - 100}개</div>}
        </div>
      </Card>
    </>
  );
}

// ---------- 자동입찰 ----------
// 그룹별 정책(목표 순위·상한·바닥·내림 허용) 편집 + 미리보기/지금 실행 + 최근 실행 기록. 30분 주기 실행은 서버(pg_cron)가 담당.
const POLICY_DEFAULT = { enabled: true, target_pos: 1, cap: 5000, floor_bid: 300, margin: 1.1, lower_ok: true };
function AutobidCard({ t, isPc, adv, actor, actorName, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const [openRun, setOpenRun] = useState(null);
  const load = useCallback(() => {
    setLoading(true);
    api("policies", { actor, get: { id: adv.id } }).then(j => { setData(j.ok ? j : null); setLoading(false); }).catch(() => { setData(null); setLoading(false); });
  }, [actor, adv.id]);
  useEffect(() => { load(); }, [load]);

  const savePolicy = async (g, patch) => {
    const cur = g.policy || { ...POLICY_DEFAULT, enabled: false };
    const next = { ...cur, ...patch };
    setBusy(g.id);
    const j = await api("policy_set", { actor, post: { id: adv.id, adgroup_id: g.id, adgroup_name: g.name, enabled: next.enabled, target_pos: next.target_pos, cap: next.cap, floor_bid: next.floor_bid, margin: next.margin, lower_ok: next.lower_ok, actor_name: actorName } });
    setBusy("");
    if (j.ok) { setData(d => d ? { ...d, groups: d.groups.map(x => x.id === g.id ? { ...x, policy: j.policy } : x) } : d); onChanged(); }
    else window.alert(j.error || "저장 실패");
  };
  const run = async (apply) => {
    if (apply && !window.confirm("켜진 그룹의 키워드 입찰가를 지금 실제로 바꿉니다. 진행할까요?")) return;
    setBusy(apply ? "run" : "dry"); setPreview(null);
    const j = await api("autobid", { actor, get: { id: adv.id, ...(apply ? { run: "1" } : {}) } });
    setBusy("");
    const r = j.ok ? (j.results || [])[0] : null;
    if (!r) { window.alert(j.error || "실행 실패"); return; }
    setPreview({ ...r, applied: apply });
    if (apply) { onChanged(); load(); }
  };

  const on = (data?.groups || []).filter(g => g.policy?.enabled);
  const runs = data?.runs || [];
  return (
    <Card t={t} title="자동입찰" sub={data ? `${on.length}개 그룹 켜짐 · 30분마다 모바일 목표 순위 예상가로 입찰가 조정 (상한 안에서)${data.cron_ready ? "" : " · 서버 CRON_SECRET 미설정 — 자동 실행 안 됨"}` : "광고그룹 불러오는 중"}>
      {!data && !loading && <Empty t={t}>불러오지 못했습니다</Empty>}
      {data && (
        <>
          {data.groups.length === 0 ? <Empty t={t}>광고그룹 없음</Empty> : data.groups.map(g => (
            <PolicyRow key={g.id} t={t} isPc={isPc} g={g} busy={busy === g.id} onSave={patch => savePolicy(g, patch)}/>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={() => run(false)} className="tab-btn" style={{ ...btnGhost(t) }} disabled={!!busy || on.length === 0}>{busy === "dry" ? "계산 중…" : "미리보기 (변경 없음)"}</button>
            <button onClick={() => run(true)} className="tab-btn" style={{ ...btnPrimary(t), flex: 1 }} disabled={!!busy || on.length === 0}>{busy === "run" ? "적용 중…" : "지금 실행"}</button>
          </div>
          {preview && (
            <div style={{ marginTop: 10, padding: 10, background: t.bgInset, borderRadius: 8, fontSize: 11.5 }}>
              <div style={{ fontWeight: 800, color: preview.error ? t.danger : t.text }}>
                {preview.error ? `오류: ${preview.error}` : preview.skipped ? preview.reason
                  : `${preview.applied ? "적용 완료" : "미리보기"} — 대상 ${preview.alive}개 중 ${preview.changed}개 ${preview.applied ? "변경" : "변경 예정"} (↑${preview.raised} ↓${preview.lowered}${preview.capped ? ` · 상한 ${preview.capped}` : ""}${preview.no_est ? ` · 예상가 없음 ${preview.no_est}` : ""})`}
              </div>
              <ChangeList t={t} changes={preview.changes}/>
            </div>
          )}
          {runs.length > 0 && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${t.border}`, paddingTop: 6 }}>
              <div style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 700, marginBottom: 2 }}>최근 실행</div>
              {runs.map(r => (
                <div key={r.id}>
                  <div onClick={() => setOpenRun(openRun === r.id ? null : r.id)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 11, cursor: "pointer", color: r.error ? t.danger : t.textSecondary }}>
                    <span className="mono" style={{ color: t.textMuted, flex: "0 0 auto" }}>{fmtKst(r.at)}</span>
                    <span style={{ flex: 1 }}>{r.dry ? "미리보기 · " : ""}{r.error ? `오류: ${r.error.slice(0, 50)}` : `${r.changed}개 조정 (↑${r.raised} ↓${r.lowered}) / 대상 ${r.alive}`}</span>
                    <span style={{ color: t.textMuted }}>{openRun === r.id ? "▴" : "▾"}</span>
                  </div>
                  {openRun === r.id && <ChangeList t={t} changes={r.changes}/>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
function ChangeList({ t, changes }) {
  const list = Array.isArray(changes) ? changes : [];
  if (list.length === 0) return <div style={{ fontSize: 11, color: t.textMuted, padding: "4px 0" }}>변경 없음</div>;
  return (
    <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
      {list.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "2px 0", color: t.textSecondary }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.kw} <span style={{ color: t.textMuted }}>· {c.grp}</span></span>
          <span className="mono" style={{ color: c.to > c.from ? t.warning : t.success }}>{won(c.from)} → {won(c.to)}원</span>
          <span className="mono" style={{ color: t.textMuted, flex: "0 0 auto" }}>{c.note}{c.est ? ` 예상 ${won(c.est)}` : ""}</span>
        </div>
      ))}
    </div>
  );
}
function PolicyRow({ t, isPc, g, busy, onSave }) {
  const p = g.policy || { ...POLICY_DEFAULT, enabled: false };
  const [cap, setCap] = useState(String(p.cap ?? 5000));
  const [floor, setFloor] = useState(String(p.floor_bid ?? 300));
  useEffect(() => { setCap(String(p.cap ?? 5000)); setFloor(String(p.floor_bid ?? 300)); }, [p.cap, p.floor_bid]);
  const on = !!p.enabled;
  const locked = g.autobidOk === false;
  const commitNums = () => {
    const c = Number(cap) || 5000, f = Number(floor) || 300;
    if (c !== Number(p.cap) || f !== Number(p.floor_bid)) onSave({ cap: c, floor_bid: f });
  };
  const sel = { ...inputStyle(t), fontFamily: "inherit", fontSize: 11.5, padding: "5px 6px", borderRadius: 6 };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "7px 0", borderTop: `1px solid ${t.border}`, opacity: busy ? 0.6 : 1 }}>
      <button onClick={() => { if (locked) { window.alert(`${g.type} 그룹은 자동입찰 대상이 아닙니다 — 파워링크만 가능`); return; } onSave({ enabled: !on }); }} className="tab-btn" title={locked ? "파워링크만 가능" : on ? "끄기" : "켜기"} style={{ width: 38, height: 22, borderRadius: 999, border: "none", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.4 : 1, background: on ? t.success : t.borderStrong, position: "relative", flex: "0 0 auto" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left .15s" }}/>
      </button>
      <span style={{ flex: isPc ? 1 : "1 1 100%", fontSize: 12, fontWeight: 700, color: g.lock ? t.textMuted : t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 120, display: "flex", alignItems: "center", gap: 6 }}>
        {g.name}{g.lock ? " (그룹 중지)" : ""}
        {g.type && <span style={{ fontSize: 9.5, fontWeight: 800, color: locked ? t.warning : t.textMuted, background: `${locked ? t.warning : t.textMuted}1F`, borderRadius: 999, padding: "1px 7px" }}>{g.type}</span>}
      </span>
      <label style={{ fontSize: 10.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>목표
        <select value={p.target_pos} onChange={e => onSave({ target_pos: Number(e.target.value) })} disabled={!on} style={sel}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}위</option>)}</select>
      </label>
      <label style={{ fontSize: 10.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>상한
        <input className="mono" value={cap} onChange={e => setCap(e.target.value.replace(/[^\d]/g, ""))} onBlur={commitNums} disabled={!on} style={{ ...sel, width: 62, textAlign: "right" }}/>원
      </label>
      <label style={{ fontSize: 10.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>바닥
        <input className="mono" value={floor} onChange={e => setFloor(e.target.value.replace(/[^\d]/g, ""))} onBlur={commitNums} disabled={!on} style={{ ...sel, width: 52, textAlign: "right" }}/>원
      </label>
      <label style={{ fontSize: 10.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
        <input type="checkbox" checked={p.lower_ok !== false} onChange={e => onSave({ lower_ok: e.target.checked })} disabled={!on}/>내리기 허용
      </label>
    </div>
  );
}

function KwRow({ t, isPc, k, cols, onBid, onLock }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(k.bid || "");
  useEffect(() => { setVal(k.bid || ""); }, [k.bid]);
  const commit = () => { setEdit(false); const n = Number(val); if (n && n !== k.bid) onBid(k, n); };
  const rankColor = k.rank == null ? t.textMuted : k.rank <= 1.5 ? t.success : k.rank <= 3 ? t.warning : t.danger;
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center", padding: "4px 0", borderTop: `1px solid ${t.border}`, fontSize: 12, opacity: k.lock ? 0.5 : 1, minWidth: isPc ? 0 : 430 }}>
      <span style={{ fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k.group}>{k.keyword}{k.lock ? " ⏸" : ""}</span>
      {isPc && <span style={{ fontSize: 10.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(k.group || "").replace(/^파워링크_/, "")}</span>}
      <span className="mono" style={{ color: t.textMuted }}>{won(k.impressions)}</span>
      <span className="mono" style={{ color: k.clicks ? t.text : t.textMuted, fontWeight: k.clicks ? 700 : 400 }}>{k.clicks}</span>
      {isPc && <span className="mono" style={{ color: t.textMuted }}>{k.ctr}%</span>}
      <span className="mono" style={{ color: rankColor, fontWeight: 700 }}>{k.rank != null ? k.rank.toFixed(1) : "-"}</span>
      {edit ? (
        <input type="number" autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setEdit(false); setVal(k.bid || ""); } }}
          className="mkt-input" style={{ padding: "3px 6px", background: t.bgInset, border: `1px solid ${t.accent}`, color: t.text, textAlign: "right", fontWeight: 800 }}/>
      ) : (
        <button onClick={() => setEdit(true)} className="tab-btn mono" title="클릭해서 변경" style={{ background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 6, padding: "3px 6px", color: t.text, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", textAlign: "right", fontSize: 12 }}>
          {won(k.bid)}{k.useGroupBid ? <span style={{ fontSize: 9, color: t.textMuted, marginLeft: 2 }}>G</span> : ""}
        </button>
      )}
      <span className="mono" style={{ color: k.top1Bid != null && k.bid < k.top1Bid ? t.warning : t.textMuted }}>{k.top1Bid != null ? won(k.top1Bid) : "-"}</span>
      <button onClick={() => onLock(k)} className="tab-btn" title={k.lock ? "재개" : "중지"} style={{ ...iconBtn(t), padding: 2, fontSize: 12 }}>{k.lock ? "▶" : "⏸"}</button>
    </div>
  );
}

function DayRow({ t, d, lead, onSave }) {
  const [val, setVal] = useState(lead?.leads ?? "");
  useEffect(() => { setVal(lead?.leads ?? ""); }, [lead?.leads]);
  const commit = () => { const n = val === "" ? 0 : Number(val); if (Number(lead?.leads || 0) !== n) onSave(d.ymd, n, lead?.note || null); };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 52px 44px 64px", gap: 6, alignItems: "center", padding: "4px 0", borderTop: `1px solid ${t.border}`, fontSize: 12 }}>
      <span style={{ fontWeight: 700, color: t.textSecondary }}>{d.ymd.slice(5)}</span>
      <span className="mono" style={{ color: t.textMuted }}>{won(Math.round(d.cost * 1.1))}원</span>
      <span className="mono" style={{ color: t.textMuted }}>{d.clicks}</span>
      <span className="mono" style={{ color: t.textMuted }}>{d.rank ? d.rank.toFixed(1) : "-"}</span>
      <div style={{ position: "relative" }}>
        <input type="number" min="0" inputMode="numeric" value={val} placeholder="입력" onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="mkt-input" title="이날 전화·문의 접수 건수" style={{ padding: "5px 18px 5px 6px", background: lead?.leads != null ? t.bgInset : `${t.accent}14`, border: `1.5px solid ${lead?.leads != null ? t.border : t.accent}`, color: t.text, textAlign: "right", fontWeight: 800 }}/>
        <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontSize: 9.5, color: lead?.leads != null ? t.success : t.accent, fontWeight: 900, pointerEvents: "none" }}>{lead?.leads != null ? "✓" : "✎"}</span>
      </div>
    </div>
  );
}

function ChangeLog({ t, logs, owner, adv, actor, actorName, onAdded }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!action.trim()) return;
    setBusy(true);
    const j = await api("log", { actor, post: { id: adv.id, action: action.trim(), detail: detail.trim(), actor_name: actorName || "운영자" } });
    setBusy(false);
    if (j.ok) { setAction(""); setDetail(""); setOpen(false); onAdded(); }
  };
  return (
    <Card t={t} title="운영 변경 이력" sub="무엇을 왜 바꿨는지">
      {logs.length === 0 ? <Empty t={t}>기록 없음</Empty> : logs.slice(0, 12).map(l => (
        <div key={l.id} style={{ padding: "6px 0", borderTop: `1px solid ${t.border}`, fontSize: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ fontWeight: 800, color: t.text }}>{l.action}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{String(l.at).slice(5, 16).replace("T", " ")}</span>
          </div>
          {l.detail && <div style={{ color: t.textSecondary, fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>{l.detail}</div>}
        </div>
      ))}
      {owner && (
        open ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <input className="mkt-input" placeholder="조치 (예: 입찰 변경)" value={action} onChange={e => setAction(e.target.value)} style={inputStyle(t)}/>
            <textarea className="mkt-input" placeholder="내용 (광고주에게 보이는 설명)" value={detail} onChange={e => setDetail(e.target.value)} rows={2} style={{ ...inputStyle(t), resize: "vertical" }}/>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={submit} disabled={busy} className="tab-btn" style={btnPrimary(t)}>기록</button>
              <button onClick={() => setOpen(false)} className="tab-btn" style={btnGhost(t)}>취소</button>
            </div>
          </div>
        ) : <button onClick={() => setOpen(true)} className="tab-btn" style={{ ...btnGhost(t), marginTop: 8 }}><Plus size={13}/> 이력 추가</button>
      )}
    </Card>
  );
}

function ShareBar({ t, adv, actor }) {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(adv.client_token);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/mkt/c/${token}`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } };
  const rotate = async () => { if (!window.confirm("기존 링크는 더 이상 열리지 않습니다. 새 링크를 만들까요?")) return; const j = await api("rotate_token", { actor, post: { id: adv.id } }); if (j.ok) setToken(j.client_token); };
  return (
    <Card t={t} title="광고주 열람 링크" sub="로그인 없이 성과·접수 입력·변경 이력만 볼 수 있는 페이지">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input readOnly value={url} className="mkt-input" style={{ ...inputStyle(t), fontSize: 11.5 }} onFocus={e => e.target.select()}/>
        <button onClick={copy} className="tab-btn" style={{ ...btnPrimary(t), flex: "0 0 auto" }}><LinkIcon size={13}/> {copied ? "복사됨" : "복사"}</button>
        <button onClick={rotate} className="tab-btn" style={{ ...btnGhost(t), flex: "0 0 auto" }}>재발급</button>
      </div>
    </Card>
  );
}

function AdvertiserForm({ t, actor, actorName, initial, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || "", slug: initial?.slug || "", customer_id: initial?.customer_id || "",
    api_key: "", api_secret: "", campaign_filter: initial?.campaign_filter || "",
    margin_per_order: initial?.margin_per_order ?? "", cpa_good: initial?.cpa_good ?? "", cpa_limit: initial?.cpa_limit ?? "",
    show_keywords: !!initial?.show_keywords, memo: initial?.memo || "", use_env: "",
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const submit = async () => {
    setBusy(true); setErr(null);
    const post = { ...f, actor_name: actorName };
    if (!post.api_key) delete post.api_key;
    if (!post.api_secret) delete post.api_secret;
    if (initial) post.id = initial.id;
    const j = await api(initial ? "update" : "add", { actor, post });
    setBusy(false);
    if (j.ok) onSaved(j.advertiser); else setErr(j.error || "저장 실패");
  };
  const remove = async () => { if (!window.confirm(`${initial.name} 을(를) 목록에서 내릴까요? (데이터는 보존)`)) return; const j = await api("remove", { actor, post: { id: initial.id } }); if (j.ok) onSaved(null); };
  // 주의: 폼 안에서 컴포넌트를 새로 정의하면 글자마다 입력칸이 재생성돼 포커스가 빠진다 → Field 를 직접 사용
  return (
    <Card t={t} title={initial ? `${initial.name} 설정` : "광고주 추가"} sub="네이버 광고시스템 → 도구 → API 사용 관리">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field t={t} value={f.name} onChange={set("name")} label="광고주 이름"  ph="쿨가이"/>
        <Field t={t} value={f.customer_id} onChange={set("customer_id")} label="CUSTOMER_ID"  ph="3458080"/>
        <Field t={t} value={f.api_key} onChange={set("api_key")} label="액세스라이선스 (API 키)"  ph={initial ? "변경할 때만 입력" : "0100000000…"}/>
        <Field t={t} value={f.api_secret} onChange={set("api_secret")} label="비밀키"  type="password" ph={initial ? "변경할 때만 입력" : "AQAAAA…"}/>
        <Field t={t} value={f.campaign_filter} onChange={set("campaign_filter")} label="캠페인 필터"  ph="벌초" hint="이 글자가 이름에 있는 캠페인만 집계 (비우면 전체)"/>
        <Field t={t} value={f.margin_per_order} onChange={set("margin_per_order")} label="접수 1건당 회사이익 (원)" type="number" ph="52500" hint="비우면 판정선 없음. 입력하면 효율 50% / 상한 100% 자동"/>
        <Field t={t} value={f.cpa_good} onChange={set("cpa_good")} label="효율 기준 (원/접수)" type="number" ph="자동"/>
        <Field t={t} value={f.cpa_limit} onChange={set("cpa_limit")} label="상한 (원/접수)" type="number" ph="자동"/>
      </div>
      {!initial && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, fontWeight: 700, color: t.textSecondary }}>
          서버에 저장된 키 사용
          <select value={f.use_env} onChange={set("use_env")} className="mkt-input" style={{ ...inputStyle(t), width: "auto", padding: "6px 8px" }}>
            <option value="">안 함 (위 칸에 직접 입력)</option>
            <option value="allday">올데이케어 (NAVER_AD_*)</option>
            <option value="yusol">유솔홈케어 (YUSOL_AD_*)</option>
          </select>
          <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>선택하면 키·비밀키·CUSTOMER_ID 칸은 비워도 됩니다</span>
        </label>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, fontWeight: 700, color: t.textSecondary }}>
        <input type="checkbox" checked={f.show_keywords} onChange={set("show_keywords")}/> 광고주 화면에 키워드 표 노출
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, fontSize: 11.5, fontWeight: 700, color: t.textSecondary }}>메모
        <textarea className="mkt-input" rows={2} value={f.memo} onChange={set("memo")} style={{ ...inputStyle(t), resize: "vertical" }} placeholder="계약 조건, 담당자, 주의사항"/>
      </label>
      {err && <div style={{ color: t.danger, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button onClick={submit} disabled={busy} className="tab-btn" style={btnPrimary(t)}>{busy ? "네이버 연결 확인 중…" : (initial ? "저장" : "연결 확인 후 등록")}</button>
        <button onClick={onClose} className="tab-btn" style={btnGhost(t)}>닫기</button>
        {initial && <button onClick={remove} className="tab-btn" style={{ ...btnGhost(t), marginLeft: "auto", color: t.danger }}>목록에서 내리기</button>}
      </div>
    </Card>
  );
}

// ---------- 공용 UI ----------
function Card({ t, title, sub, children }) {
  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12, padding: "13px 14px 12px" }}>
      <div style={{ marginBottom: 9 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function MiniStat({ t, label, value, suffix, accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 10px", background: t.bgInset, borderRadius: 8, textAlign: "center" }}>
      <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 700 }}>{label}</span>
      <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: accent ? t.accent : t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}{suffix && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginLeft: 2 }}>{suffix}</span>}
      </span>
    </div>
  );
}
function Field({ t, label, type = "text", value, onChange, ph, hint }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: t.textSecondary }}>
      {label}
      <input className="mkt-input" type={type} value={value} onChange={onChange} placeholder={ph} style={inputStyle(t)} autoComplete="off"/>
      {hint && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{hint}</span>}
    </label>
  );
}
function Empty({ t, children }) { return <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>{children}</div>; }
const inputStyle = (t) => ({ background: t.bgInset, border: `1px solid ${t.border}`, color: t.text });
const btnPrimary = (t) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", background: t.accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" });
const btnGhost = (t) => ({ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const iconBtn = (t) => ({ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: t.textMuted, display: "flex" });
