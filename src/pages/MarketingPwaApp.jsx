// 2026-08-03 — 올잇 마케팅 PWA (src/pages/MarketingPwaApp.jsx)
//   진입: ollit.vercel.app/mkt (App.jsx 경로 분기). 로그인은 올잇 계정 그대로, 대표(owner)만.
//   디자인: 운영 PWA 와 동일 문법 — THEMES 토큰(다크/라이트), sticky 헤더, Card/MiniStat,
//           Pretendard, 하단 여백 safe-area. (MarketingScreenMobile 패턴 이식)
//   구조: ADVERTISERS 배열 — 광고주가 늘면 한 줄 추가.

import { useEffect, useMemo, useState } from "react";
import { Sun, Moon, LogOut, ExternalLink } from "lucide-react";

const YUSOL_AD_TOKEN = "yz74c1e0a95d2b8f36e41c07";

const ADVERTISERS = [
  { id: "yusol",  name: "유솔홈케어" },
  { id: "allday", name: "올데이케어" },
  // 새 광고주는 여기 추가
];

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

export default function MarketingPwaApp({ user, onLogout }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem("mkt_theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
  });
  const t = THEMES[mode];
  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    try { localStorage.setItem("mkt_theme", next); } catch { /* */ }
  };
  const [adv, setAdv] = useState("yusol");

  // PC 분기 (운영 PWA 와 동일 기준 1024px) — 좌측 사이드바 + 넓은 본문
  const [isPc, setIsPc] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  useEffect(() => {
    const onResize = () => setIsPc(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (isPc) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Pretendard', sans-serif", display: "flex" }}>
        <style>{`
          @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .fade-in { animation: slideUp 0.4s ease-out; }
          .tab-btn:hover { opacity: 0.85; }
        `}</style>
        {/* 사이드바 */}
        <aside style={{ width: 230, flexShrink: 0, background: t.bgElevated, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${t.border}` }}>
            <div className="mono" style={{ fontSize: 9, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>ALLIT MARKETING</div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>📈 올잇 마케팅</div>
            <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: 3 }}>{user?.name ? `${user.name} 님` : ""} · 광고주 {ADVERTISERS.length}곳</div>
          </div>
          <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            {ADVERTISERS.map(a => {
              const on = adv === a.id;
              return (
                <button key={a.id} onClick={() => setAdv(a.id)} className="tab-btn" style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
                  background: on ? t.accentBg : "transparent", border: "none",
                  borderLeft: `3px solid ${on ? t.accent : "transparent"}`, borderRadius: 8,
                  color: on ? t.accent : t.textSecondary, fontSize: 14, fontWeight: on ? 800 : 600,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}>{a.name}</button>
              );
            })}
          </nav>
          <div style={{ padding: "14px 14px 18px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 8 }}>
            <button onClick={toggleMode} className="tab-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {mode === "dark" ? <Sun size={14}/> : <Moon size={14}/>} 테마
            </button>
            <button onClick={onLogout} className="tab-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <LogOut size={14}/> 로그아웃
            </button>
          </div>
        </aside>
        {/* 본문 */}
        <main className="fade-in" style={{ flex: 1, minWidth: 0, overflow: "auto", height: "100vh", padding: "24px 28px 40px" }}>
          <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {adv === "yusol" && <YusolPanel t={t} isPc/>}
            {adv === "allday" && (
              <Card t={t} title="올데이케어 광고 관제판" sub="실시간 키워드 · 순위 · 자동입찰은 기존 관제판에서">
                <a href="/ads-console.html" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 0", borderRadius: 10, background: t.accent, color: "#fff", fontSize: 13.5, fontWeight: 800, textDecoration: "none", maxWidth: 360 }}>관제판 열기 <ExternalLink size={14}/></a>
              </Card>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, paddingTop: "env(safe-area-inset-top, 12px)" }}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: slideUp 0.4s ease-out; }
        .tab-btn:hover { opacity: 0.85; }
      `}</style>
      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>

        {/* 헤더 — 운영 PWA 와 동일 문법 (sticky + bgElevated) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${t.border}`, background: t.bgElevated, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📈 올잇 마케팅</div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 1 }}>
              {user?.name ? `${user.name} 님 · ` : ""}관리 광고주 {ADVERTISERS.length}곳
            </div>
          </div>
          <button onClick={toggleMode} className="tab-btn" aria-label="테마 전환" style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: t.textMuted, display: "flex" }}>
            {mode === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          <button onClick={onLogout} className="tab-btn" aria-label="로그아웃" style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: t.textMuted, display: "flex" }}>
            <LogOut size={18}/>
          </button>
        </div>

        <div className="fade-in" style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 광고주 세그먼트 */}
          <div style={{ display: "flex", gap: 6 }}>
            {ADVERTISERS.map(a => {
              const on = adv === a.id;
              return (
                <button key={a.id} type="button" onClick={() => setAdv(a.id)} className="tab-btn" style={{
                  flex: 1, padding: "10px 0", background: on ? t.accent : "transparent",
                  border: `1px solid ${on ? t.accent : t.border}`, borderRadius: 10,
                  color: on ? "#fff" : t.textSecondary, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                }}>{a.name}</button>
              );
            })}
          </div>

          {adv === "yusol" && <YusolPanel t={t}/>}
          {adv === "allday" && (
            <Card t={t} title="올데이케어 광고 관제판" sub="실시간 키워드 · 순위 · 자동입찰은 기존 관제판에서">
              <a href="/ads-console.html" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "13px 0", borderRadius: 10, background: t.accent, color: "#fff",
                fontSize: 13.5, fontWeight: 800, textDecoration: "none",
              }}>관제판 열기 <ExternalLink size={14}/></a>
            </Card>
          )}

          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, textAlign: "center", padding: "4px 2px" }}>
            ALLIT MARKETING · 홈 화면에 추가하면 앱처럼 쓸 수 있어요
          </div>
        </div>
      </div>
    </div>
  );
}

function YusolPanel({ t, isPc }) {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days8, setDays8] = useState(null);

  const { since, until } = useMemo(() => {
    const today = kstYmd(0);
    if (period === "today") return { since: today, until: today };
    if (period === "week")  return { since: kstYmd(-6), until: today };
    return { since: today.slice(0, 8) + "01", until: today };
  }, [period]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/yusol-ad?token=${YUSOL_AD_TOKEN}&since=${since}&until=${until}&daily=1`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (alive) { setData(j && j.ok ? j : null); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoading(false); } });
    return () => { alive = false; };
  }, [since, until]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`/api/yusol-ad?token=${YUSOL_AD_TOKEN}&since=${kstYmd(-7)}&until=${kstYmd(0)}&daily=1`, { cache: "no-store" })
        .then(r => r.json())
        .then(j => { if (alive) setDays8(j && j.ok ? (j.days || []) : null); })
        .catch(() => { if (alive) setDays8(null); });
    };
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const costVat = Math.round(Number(data.cost || 0) * 1.1);
    const conv = Number(data.conv || 0);
    const per = conv > 0 ? Math.round(costVat / conv) : null;
    let verdict;
    if (per != null && per <= 5000)       verdict = { label: "효율 좋음", color: t.success };
    else if (per != null && per <= 10000) verdict = { label: "적정", color: t.warning };
    else if (per != null)                  verdict = { label: "조정 필요", color: t.danger };
    else if (costVat > 0)                  verdict = { label: "주문 집계 전", color: t.warning };
    else                                   verdict = { label: "라이브 대기", color: t.textMuted };
    const camps = (data.campaigns || []).map(c => ({
      id: c.id, name: c.name,
      costVat: Math.round(Number(c.cost || 0) * 1.1),
      clicks: Number(c.clicks || 0), conv: Number(c.conv || 0),
    })).sort((a, b) => b.costVat - a.costVat);
    const days = (data.days || []).slice().reverse().map(d => ({
      ymd: d.ymd, costVat: Math.round(Number(d.cost || 0) * 1.1),
      clicks: Number(d.clicks || 0), conv: Number(d.conv || 0),
    }));
    return { costVat, clicks: Number(data.clicks || 0), conv, per, verdict, camps, days };
  }, [data, t]);

  const patrol = useMemo(() => {
    if (!days8 || days8.length === 0) return null;
    const today = kstYmd(0);
    const row = days8.find(d => d.ymd === today);
    const prev = days8.filter(d => d.ymd !== today);
    const avg = prev.length > 0 ? prev.reduce((a, d) => a + d.clicks, 0) / prev.length : 0;
    const tc = row?.clicks || 0;
    const ratio = avg > 0 ? tc / avg : null;
    return { tc, avg: Math.round(avg), ratio, alert: ratio != null && ratio >= 2.5 && tc >= 20 };
  }, [days8]);

  return (
    <>
      {/* 기간 필터 */}
      <div style={{ display: "flex", gap: 6 }}>
        {PERIODS.map(p => {
          const on = period === p.id;
          return (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className="tab-btn" style={{
              flex: 1, padding: "8px 0", background: on ? t.accentBg : "transparent",
              border: `1px solid ${on ? t.accent : t.border}`, borderRadius: 10,
              color: on ? t.accent : t.textSecondary, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{p.label}</button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: -6 }}>
        {since === until ? `${since} (하루)` : `${since} ~ ${until}`} · KST · 5분마다 갱신
      </div>

      {loading && !view ? (
        <Card t={t} title="🧼 유솔 광고 성과">
          <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>불러오는 중…</div>
        </Card>
      ) : !view ? (
        <Card t={t} title="🧼 유솔 광고 성과">
          <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>연결 대기 — 광고 라이브 후 표시됩니다</div>
        </Card>
      ) : (
        <>
          <Card t={t} title="🧼 유솔 광고 성과" sub="주문당 5천 이하 효율 / 1만 상한 (벽걸이 마진 1.8만 기준)">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                {view.per != null ? won(view.per) : "-"}
                <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 700, marginLeft: 3 }}>원/주문</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: view.verdict.color, background: `${view.verdict.color}1F`, borderRadius: 999, padding: "4px 11px" }}>{view.verdict.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <MiniStat t={t} label="광고비(VAT포함)" value={won(view.costVat)} suffix="원" accent/>
              <MiniStat t={t} label="클릭" value={won(view.clicks)}/>
              <MiniStat t={t} label="주문(전환)" value={won(view.conv)}/>
            </div>
            {patrol && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}`, fontSize: 10.5, fontWeight: 700, color: patrol.alert ? t.danger : t.textMuted }}>
                {patrol.alert
                  ? `⚠ 클릭 급증 의심 — 오늘 ${patrol.tc}클릭 (직전7일 평균 ${patrol.avg}의 ${patrol.ratio.toFixed(1)}배). 노출제한 IP 점검`
                  : `🛡 클릭 감시 정상 — 오늘 ${patrol.tc} · 직전7일 평균 ${patrol.avg}`}
              </div>
            )}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: isPc ? "1fr 1fr" : "1fr", gap: 12 }}>
            <Card t={t} title="캠페인별">
              {view.camps.length === 0 ? (
                <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>캠페인 준비 중</div>
              ) : view.camps.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${t.border}`, fontSize: 12 }}>
                  <span style={{ flex: 1, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span className="mono" style={{ color: t.textMuted }}>{won(c.costVat)}원</span>
                  <span className="mono" style={{ color: t.textMuted }}>{c.clicks}클릭</span>
                  <span className="mono" style={{ fontWeight: 800, color: c.conv > 0 ? t.success : t.textMuted }}>{c.conv}주문</span>
                </div>
              ))}
            </Card>

            <Card t={t} title="일별 흐름">
              {view.days.length === 0 ? (
                <div style={{ padding: 12, textAlign: "center", color: t.textMuted, fontSize: 12 }}>아직 집계된 날이 없습니다</div>
              ) : view.days.map(d => (
                <div key={d.ymd} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px solid ${t.border}`, fontSize: 12 }}>
                  <span style={{ width: 44, flexShrink: 0, fontWeight: 700, color: t.textSecondary }}>{d.ymd.slice(5)}</span>
                  <span className="mono" style={{ flex: 1, color: t.textMuted }}>{won(d.costVat)}원</span>
                  <span className="mono" style={{ color: t.textMuted }}>{d.clicks}클릭</span>
                  <span className="mono" style={{ fontWeight: 800, color: d.conv > 0 ? t.success : t.textMuted }}>{d.conv}주문</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

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
