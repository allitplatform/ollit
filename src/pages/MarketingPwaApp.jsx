// 2026-08-03 — 올잇 마케팅 PWA (src/pages/MarketingPwaApp.jsx)
//   진입: ollit.vercel.app/mkt (App.jsx 경로 분기). 로그인은 올잇 계정(폰번호+비밀번호) 그대로.
//   접근: role === "owner" (대표/운영자) 만. 그 외 역할은 안내 화면.
//   구조: 광고주 목록(ADVERTISERS 배열) — 광고주가 늘면 여기 한 줄씩 추가.
//     · yusol  : /api/yusol-ad (검색광고 계정 622180) — 성과·클릭감시·캠페인·일별
//     · allday : 기존 광고 관제판(/ads-console.html) 연결
//   다크 고정 테마 (올잇 로그인 화면과 동일 톤).

import { useEffect, useMemo, useState } from "react";

const YUSOL_AD_TOKEN = "yz74c1e0a95d2b8f36e41c07";

const ADVERTISERS = [
  { id: "yusol",  name: "유솔홈케어", kind: "api" },
  { id: "allday", name: "올데이케어", kind: "console", href: "/ads-console.html" },
  // 새 광고주는 여기 추가: { id, name, kind:"api", token, ... }
];

const C = {
  bg: "#0A0A0A", card: "#161616", inset: "#1E1E1E", ink: "#F5F5F5", ink2: "#B9BDC4",
  mut: "#7d8590", line: "#262626", accent: "#FF1B8D",
  good: "#22C55E", warn: "#F59E0B", bad: "#EF4444",
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
  const [adv, setAdv] = useState("yusol");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Pretendard', sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.3 }}>올잇 마케팅</span>
          <span style={{ fontSize: 9.5, color: C.mut, fontWeight: 700, letterSpacing: 1.5 }}>광고주 관제판</span>
          <button onClick={onLogout} style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${C.line}`, color: C.mut, fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>로그아웃</button>
        </div>
        <div style={{ fontSize: 11, color: C.mut, fontWeight: 600, marginBottom: 13 }}>
          {user?.name ? `${user.name} 님 · ` : ""}관리 광고주 {ADVERTISERS.length}곳
        </div>

        {/* 광고주 선택 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {ADVERTISERS.map(a => {
            const on = adv === a.id;
            return (
              <button key={a.id} onClick={() => setAdv(a.id)} style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                background: on ? C.accent : C.card, border: `1px solid ${on ? C.accent : C.line}`,
                color: on ? "#fff" : C.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>{a.name}</button>
            );
          })}
        </div>

        {adv === "yusol"  && <YusolPanel/>}
        {adv === "allday" && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "15px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>올데이케어 광고 관제판</div>
            <div style={{ fontSize: 10.5, color: C.mut, fontWeight: 600, lineHeight: 1.7, marginBottom: 12 }}>
              올데이케어는 기존 관제판(실시간 키워드·순위·자동입찰)을 사용합니다.
            </div>
            <a href="/ads-console.html" style={{ display: "block", textAlign: "center", padding: "14px 0", borderRadius: 13, background: C.accent, color: "#fff", fontSize: 13.5, fontWeight: 800, textDecoration: "none" }}>관제판 열기 →</a>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 10, color: C.mut, fontWeight: 700, marginTop: 18 }}>
          ALLIT MARKETING · 홈 화면에 추가하면 앱처럼 쓸 수 있습니다
        </div>
      </div>
    </div>
  );
}

function YusolPanel() {
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
    if (per != null && per <= 5000)       verdict = { label: "효율 좋음", color: C.good };
    else if (per != null && per <= 10000) verdict = { label: "적정", color: C.warn };
    else if (per != null)                  verdict = { label: "조정 필요", color: C.bad };
    else if (costVat > 0)                  verdict = { label: "주문 집계 전", color: C.warn };
    else                                   verdict = { label: "라이브 대기", color: "#94a3b8" };
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
  }, [data]);

  const patrol = useMemo(() => {
    if (!days8 || days8.length === 0) return null;
    const today = kstYmd(0);
    const t = days8.find(d => d.ymd === today);
    const prev = days8.filter(d => d.ymd !== today);
    const avg = prev.length > 0 ? prev.reduce((a, d) => a + d.clicks, 0) / prev.length : 0;
    const tc = t?.clicks || 0;
    const ratio = avg > 0 ? tc / avg : null;
    return { tc, avg: Math.round(avg), ratio, alert: ratio != null && ratio >= 2.5 && tc >= 20 };
  }, [days8]);

  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "15px 16px 13px", marginBottom: 12 };
  const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${C.line}`, fontSize: 12 };

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PERIODS.map(p => {
          const on = period === p.id;
          return (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              flex: 1, padding: "8px 0", borderRadius: 10,
              background: on ? "rgba(255,27,141,.12)" : "transparent",
              border: `1px solid ${on ? C.accent : C.line}`,
              color: on ? C.accent : C.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{p.label}</button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: C.mut, fontWeight: 600, marginBottom: 12 }}>
        {since === until ? `${since} (하루)` : `${since} ~ ${until}`} · KST · 5분마다 갱신
      </div>

      {loading && !view ? (
        <div style={{ ...card, textAlign: "center", color: C.mut, fontSize: 12 }}>불러오는 중…</div>
      ) : !view ? (
        <div style={{ ...card, textAlign: "center", color: C.mut, fontSize: 12 }}>연결 대기 — 광고 라이브 후 표시됩니다</div>
      ) : (
        <>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 27, fontWeight: 900 }}>
                {view.per != null ? won(view.per) : "-"}
                <span style={{ fontSize: 13, color: C.mut, fontWeight: 700, marginLeft: 3 }}>원/주문</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: view.verdict.color, background: "rgba(255,255,255,.06)", borderRadius: 999, padding: "4px 11px" }}>{view.verdict.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[["광고비(VAT포함)", won(view.costVat) + "원"], ["클릭", won(view.clicks)], ["주문(전환)", won(view.conv)]].map(([l, v]) => (
                <div key={l} style={{ background: C.inset, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: C.mut, fontWeight: 700, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
                </div>
              ))}
            </div>
            {patrol && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: 10.5, fontWeight: 700, color: patrol.alert ? C.bad : C.mut }}>
                {patrol.alert
                  ? `⚠ 클릭 급증 의심 — 오늘 ${patrol.tc}클릭 (직전7일 평균 ${patrol.avg}의 ${patrol.ratio.toFixed(1)}배). 노출제한 IP 점검`
                  : `🛡 클릭 감시 정상 — 오늘 ${patrol.tc} · 직전7일 평균 ${patrol.avg}`}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 10, color: C.mut, fontWeight: 600, lineHeight: 1.7 }}>
              판정: 주문당 5,000원 이하 효율 · 10,000원 이하 적정 · 초과 조정 (벽걸이 마진 1.8만 기준)
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>캠페인별</div>
            {view.camps.length === 0 ? (
              <div style={{ padding: 12, textAlign: "center", color: C.mut, fontSize: 12 }}>캠페인 준비 중</div>
            ) : view.camps.map(c => (
              <div key={c.id} style={rowStyle}>
                <span style={{ flex: 1, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <span style={{ color: C.ink2 }}>{won(c.costVat)}원</span>
                <span style={{ color: C.ink2 }}>{c.clicks}클릭</span>
                <span style={{ fontWeight: 800, color: c.conv > 0 ? C.good : C.mut }}>{c.conv}주문</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>일별 흐름</div>
            {view.days.length === 0 ? (
              <div style={{ padding: 12, textAlign: "center", color: C.mut, fontSize: 12 }}>아직 집계된 날이 없습니다</div>
            ) : view.days.map(d => (
              <div key={d.ymd} style={rowStyle}>
                <span style={{ width: 44, flexShrink: 0, fontWeight: 700, color: C.ink2 }}>{d.ymd.slice(5)}</span>
                <span style={{ flex: 1, color: C.ink2 }}>{won(d.costVat)}원</span>
                <span style={{ color: C.ink2 }}>{d.clicks}클릭</span>
                <span style={{ fontWeight: 800, color: d.conv > 0 ? C.good : C.mut }}>{d.conv}주문</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
