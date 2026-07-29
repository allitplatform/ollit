// 2026-07-26 — 광고 관제판 데이터 API (api/ad-console.js)
// GET ?token=... → 살아있는 키워드 전체: 그룹/입찰가/상태 + 오늘 성과 + 모바일 1위가
// 프런트: /ads-console.html (독립 페이지)

import crypto from "crypto";

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";
const TOKEN      = "85cd10a6b18bed7ad40ace71d23fb1fe0f244e425d6184bb"; // 업체용 보기 (추정만)
const TOKEN_FULL = "82ae0c34ae8eeec0f6932b82"; // 대표용 보기 (실제 접수 포함, 조작 불가)
const WRITE_TOKEN = "b29adde027905ee35c810634f09bda48a697f973fbdb8ca8"; // 관리자
const CAMPAIGN_ID = "cmp-a001-01-000000010808110";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// 영어 지명 → 한글 (전국판 · IP 지오 DB가 영문 로마자로 줘서 변환)
const KO_PLACE = { "Seoul":"서울","Incheon":"인천","Busan":"부산","Daegu":"대구","Daejeon":"대전","Gwangju":"광주","Ulsan":"울산","Sejong":"세종",
  "Gyeonggi-do":"경기","Gangwon-do":"강원","Gangwon State":"강원","Chungcheongbuk-do":"충북","Chungcheongnam-do":"충남","Jeollabuk-do":"전북","Jeonbuk State":"전북","Jeollanam-do":"전남","Gyeongsangbuk-do":"경북","Gyeongsangnam-do":"경남","Jeju-do":"제주",
  "Jongno-gu":"종로구","Jung-gu":"중구","Yongsan-gu":"용산구","Seongdong-gu":"성동구","Gwangjin-gu":"광진구","Dongdaemun-gu":"동대문구","Jungnang-gu":"중랑구","Seongbuk-gu":"성북구","Gangbuk-gu":"강북구","Dobong-gu":"도봉구","Nowon-gu":"노원구","Eunpyeong-gu":"은평구","Seodaemun-gu":"서대문구","Mapo-gu":"마포구","Yangcheon-gu":"양천구","Gangseo-gu":"강서구","Guro-gu":"구로구","Geumcheon-gu":"금천구","Yeongdeungpo-gu":"영등포구","Dongjak-gu":"동작구","Gwanak-gu":"관악구","Seocho-gu":"서초구","Gangnam-gu":"강남구","Songpa-gu":"송파구","Gangdong-gu":"강동구",
  "Bupyeong-gu":"부평구","Namdong-gu":"남동구","Yeonsu-gu":"연수구","Michuhol-gu":"미추홀구","Gyeyang-gu":"계양구","Seo-gu":"서구","Dong-gu":"동구","Buk-gu":"북구","Nam-gu":"남구","Ganghwa-gun":"강화군",
  "Goyang":"고양시","Paju":"파주시","Gimpo":"김포시","Bucheon":"부천시","Suwon":"수원시","Seongnam":"성남시","Yongin":"용인시","Anyang":"안양시","Ansan":"안산시","Namyangju":"남양주시","Uijeongbu":"의정부시","Hwaseong":"화성시","Siheung":"시흥시","Pyeongtaek":"평택시","Gwangmyeong":"광명시","Hanam":"하남시","Guri":"구리시","Gunpo":"군포시","Uiwang":"의왕시","Osan":"오산시","Icheon":"이천시","Anseong":"안성시","Yangju":"양주시","Pocheon":"포천시","Dongducheon":"동두천시","Gwacheon":"과천시","Yeoju":"여주시","Yangpyeong":"양평군","Gapyeong":"가평군","Yeoncheon":"연천군",
  "Cheonan":"천안시","Asan":"아산시","Seosan":"서산시","Dangjin":"당진시","Gongju":"공주시","Nonsan":"논산시","Boryeong":"보령시","Gyeryong":"계룡시","Hongseong":"홍성군","Yesan":"예산군","Taean":"태안군","Buyeo":"부여군","Seocheon":"서천군","Cheongyang":"청양군","Geumsan":"금산군",
  "Cheongju":"청주시","Chungju":"충주시","Jecheon":"제천시","Jincheon":"진천군","Eumseong":"음성군","Okcheon":"옥천군",
  "Chuncheon":"춘천시","Wonju":"원주시","Gangneung":"강릉시","Sokcho":"속초시","Donghae":"동해시","Samcheok":"삼척시",
  "Jeonju":"전주시","Gunsan":"군산시","Iksan":"익산시","Mokpo":"목포시","Yeosu":"여수시","Suncheon":"순천시","Gwangyang":"광양시",
  "Changwon":"창원시","Gimhae":"김해시","Yangsan":"양산시","Jinju":"진주시","Geoje":"거제시","Tongyeong":"통영시","Pohang":"포항시","Gumi":"구미시","Gyeongju":"경주시","Gyeongsan":"경산시","Andong":"안동시","Gimcheon":"김천시",
  "Jeju City":"제주시","Seogwipo":"서귀포시","Incheon Metropolitan City":"인천" };
function koPlace(s) {
  if (!s) return s;
  if (KO_PLACE[s]) return KO_PLACE[s];
  // "Cheonan-si" → "Cheonan" 처럼 접미사 떼고 재조회
  const base = String(s).replace(/-(si|gun|gu)$/i, "");
  if (KO_PLACE[base]) return KO_PLACE[base];
  return s;
}
function koIsp(s) {
  if (!s) return s; const t = String(s).toLowerCase();
  if (t.includes("korea telecom") || t.includes("kt ")) return "KT";
  if (t.includes("sk broadband") || t.includes("hanaro")) return "SK브로드밴드";
  if (t.includes("sk telecom")) return "SKT";
  if (t.includes("lg dacom") || t.includes("lg powercomm") || t.includes("lg uplus") || t.includes("lguplus")) return "LG유플러스";
  return s;
}

async function sbGetLog() {
  const r = await fetch(`${SB_URL}/rest/v1/ad_click_log?order=ts.desc&limit=800`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  const list = r.ok ? await r.json() : [];
  const byIp = {};
  for (const c of list) {
    const k = c.ip || "?";
    const v = byIp[k] = byIp[k] || { n: 0, last: null, ad: 0, ref: "", times: [], bot: false };
    v.n++; if (!v.last) v.last = c.ts;
    if ((c.ref || "").includes("navercorp")) v.bot = true; // 네이버 내부 점검봇 (과금 아님)
    else if ((c.qs || "").includes("n_") || (c.ref || "").includes("naver")) { v.ad++; v.times.push(new Date(c.ts).getTime()); }
    if (!v.ref && c.ref) v.ref = c.ref.slice(0, 60);
  }
  // 연타 감지: 광고 클릭 3번이 10분 안에 몰려 있으면 의심
  for (const v of Object.values(byIp)) {
    v.times.sort((a, b) => a - b);
    v.burst = false;
    for (let i = 0; i + 2 < v.times.length; i++) if (v.times[i + 2] - v.times[i] <= 600000) { v.burst = true; break; }
    delete v.times;
  }
  // 정렬: 의심(연타·광고4회+) 먼저 → 광고 유입 많은 순 → 방문 순. 네이버 점검봇은 맨 아래.
  const score = v => v.bot ? -1 : ((v.burst || v.ad >= 4) ? 2 : (v.n >= 4 ? 1 : 0));
  const ips = Object.entries(byIp).map(([ip, v]) => ({ ip, ...v }))
    .sort((a, b) => (score(b) - score(a)) || (b.ad - a.ad) || (b.n - a.n)).slice(0, 100);
  return { total: list.length, ips };
}

async function sbGet(qs) {
  const r = await fetch(`${SB_URL}/rest/v1/ad_autobid_log?${qs}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? r.json() : [];
}

export const maxDuration = 60;

function sign(method, path) {
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", NAVER_SECRET)
    .update(`${ts}.${method}.${path}`).digest("base64");
  return { "X-Timestamp": String(ts), "X-API-KEY": NAVER_API_KEY,
    "X-Customer": NAVER_CUSTOMER, "X-Signature": sig, "Content-Type": "application/json" };
}

async function call(method, path, qs, body) {
  const url = qs ? `${NAVER_BASE}${path}?${qs}` : `${NAVER_BASE}${path}`;
  const r = await fetch(url, { method, headers: sign(method, path),
    body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`naver ${path} ${r.status}: ${text.slice(0,150)}`);
  return data;
}

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
const norm = (x) => String(x || "").replace(/\s+/g, "").toUpperCase();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const tk = req.query.token || "";
  if (tk !== TOKEN && tk !== TOKEN_FULL && tk !== WRITE_TOKEN) { res.status(404).end(); return; }
  try {
    // 보고서 목록 — 대표/관리자만 (업체 비번에는 안 보임)
    if (req.query.reports) {
      if (tk === TOKEN) { res.status(200).json({ ok: true, list: [] }); return; }
      const r = await fetch(`${SB_URL}/rest/v1/ad_daily_report?select=slug,d,created_at&order=created_at.desc&limit=60`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      res.status(200).json({ ok: true, list: r.ok ? await r.json() : [] });
      return;
    }

    // 흐름 데이터 (?trend=1): 시간대별 지출 곡선 + 실측 순위 48시간 추세
    if (req.query.trend) {
      const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const out = { ok: true, spend: [], snap: null, serp: {} };
      try {
        const s = await fetch(`${SB_URL}/rest/v1/ad_autobid_log?kw=eq._bizmoney&grp=eq.${kst}&order=run_at.asc&limit=1&select=bid_from`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
        if (s && s[0]) out.snap = s[0].bid_from;
        const b = await fetch(`${SB_URL}/rest/v1/ad_autobid_log?kw=eq._bz&grp=eq.${kst}&order=run_at.asc&limit=200&select=run_at,bid_from`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
        if (Array.isArray(b) && out.snap) out.spend = b.map(x => ({ at: x.run_at, won: Math.max(0, out.snap - x.bid_from) }));
      } catch (e) {}
      try {
        const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const sr = await fetch(`${SB_URL}/rest/v1/ad_serp_rank?ts=gte.${encodeURIComponent(since)}&order=ts.asc&limit=1000&select=ts,kw,rank,rival`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
        for (const r2 of (Array.isArray(sr) ? sr : [])) {
          (out.serp[r2.kw] = out.serp[r2.kw] || []).push({ t: r2.ts, r: r2.rank, v: r2.rival });
        }
      } catch (e) {}
      // 시각별 접수 건수 (KST 0~23시, 어제 포함) — 관리 토큰만
      try {
        if (tk === TOKEN_FULL || tk === WRITE_TOKEN || (req.query.wt || "") === WRITE_TOKEN) {
          const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
          const pr = await fetch(`${SB_URL}/rest/v1/principals?code=eq.allday&select=id`, { headers: H }).then(r => r.json());
          const pid = pr && pr[0] && pr[0].id;
          if (pid) {
            const yst = new Date(Date.now() + 9 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
            const stISO = new Date(`${yst}T00:00:00+09:00`).toISOString();
            const enISO = new Date(`${kst}T23:59:59+09:00`).toISOString();
            const tr = await fetch(`${SB_URL}/rest/v1/tasks?principal_id=eq.${pid}`
              + `&created_at=gte.${encodeURIComponent(stISO)}&created_at=lt.${encodeURIComponent(enISO)}`
              + `&select=created_at&limit=3000`, { headers: H }).then(r => r.json());
            const th = new Array(24).fill(0), yh = new Array(24).fill(0);
            for (const t of (Array.isArray(tr) ? tr : [])) {
              const k = new Date(new Date(t.created_at).getTime() + 9 * 3600 * 1000);
              const d = k.toISOString().slice(0, 10), h = k.getUTCHours();
              if (d === kst) th[h]++; else if (d === yst) yh[h]++;
            }
            out.jobsH = th; out.jobsHY = yh;
          }
        }
      } catch (e) {}
      res.status(200).json(out);
      return;
    }

    // 접수 지역 분포 (?regions=1&days=N) — 시·구 단위만 집계, 상세주소/고객정보는 절대 안 나감
    if (req.query.regions) {
      if (tk !== TOKEN_FULL && tk !== WRITE_TOKEN && (req.query.wt || "") !== WRITE_TOKEN) { res.status(404).end(); return; }
      const days = Math.min(60, Math.max(1, Number(req.query.days || 14)));
      const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
      const pr = await fetch(`${SB_URL}/rest/v1/principals?code=eq.allday&select=id`, { headers: H }).then(r => r.json());
      const pid = pr && pr[0] && pr[0].id;
      if (!pid) { res.status(200).json({ ok: false, error: "principal 없음" }); return; }
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const rowsR = await fetch(`${SB_URL}/rest/v1/tasks?principal_id=eq.${pid}`
        + `&created_at=gte.${encodeURIComponent(since)}&select=address&limit=5000`, { headers: H }).then(r => r.json());
      const MET = { "서울": "서울", "서울시": "서울", "서울특별시": "서울",
        "부산": "부산", "부산시": "부산", "부산광역시": "부산", "대구": "대구", "대구시": "대구", "대구광역시": "대구",
        "인천": "인천", "인천시": "인천", "인천광역시": "인천", "광주": "광주", "광주시": "광주", "광주광역시": "광주",
        "대전": "대전", "대전시": "대전", "대전광역시": "대전", "울산": "울산", "울산시": "울산", "울산광역시": "울산",
        "세종": "세종", "세종시": "세종", "세종특별자치시": "세종", "제주": "제주", "제주시": "제주", "제주도": "제주" };
      const DO = /^(경기|경기도|강원|강원도|강원특별자치도|충북|충청북도|충남|충청남도|전북|전라북도|전북특별자치도|전남|전라남도|경북|경상북도|경남|경상남도)$/;
      const agg = {}, miss = {};
      for (const t of (Array.isArray(rowsR) ? rowsR : [])) {
        const a2 = String(t.address || "").trim().replace(/\s+/g, " ");
        const tok = a2.split(" ");
        let k = null;
        if (tok[0] && MET[tok[0]]) {
          const gu = (tok[1] && /(구|군)$/.test(tok[1])) ? tok[1] : "";
          k = MET[tok[0]] + (gu ? " " + gu : "");
        } else if (tok[0] && DO.test(tok[0])) {
          const si = (tok[1] && /(시|군)$/.test(tok[1])) ? tok[1] : "";
          k = si || tok[0];
        } else if (tok[0] && /(시|군)$/.test(tok[0])) {
          k = tok[0];
        } else if (tok[0] && /(구)$/.test(tok[0])) {
          k = "서울 " + tok[0];
        }
        if (!k) {
          k = "(주소미상)";
          const pf = a2 ? tok.slice(0, 2).join(" ").slice(0, 12) : "(빈값)";
          miss[pf] = (miss[pf] || 0) + 1;
        }
        agg[k] = (agg[k] || 0) + 1;
      }
      res.status(200).json({ ok: true, days, total: (rowsR || []).length,
        rows: Object.entries(agg).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ area: k, n: v })),
        miss: Object.entries(miss).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => ({ p: k, n: v })) });
      return;
    }

    // 접수 → 매출 깔때기 (?funnel=1&days=N) — "광고비 대비 진짜 얼마 벌었나"
    // 접수 건수만 세면 취소·노쇼가 안 보인다. 상태 분포 + payments 합계까지 본다.
    // 7/29 추가: 시간대(KST 0~23)별 접수. 네이버 /stats 의 breakdown=hh24 와 시간축을 맞춰
    //  "그 시간대에 클릭 N건 사서 접수 M건 나왔나"를 볼 수 있게 한다.
    //  hours[] = 기간 전체 합(상태별), rows[].h = 날짜별 24칸 접수 건수.
    if (req.query.funnel) {
      if (tk !== TOKEN_FULL && tk !== WRITE_TOKEN && (req.query.wt || "") !== WRITE_TOKEN) { res.status(404).end(); return; }
      const days = Math.min(60, Math.max(1, Number(req.query.days || 7)));
      const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
      const pr = await fetch(`${SB_URL}/rest/v1/principals?code=eq.allday&select=id`, { headers: H }).then(r => r.json());
      const pid = pr && pr[0] && pr[0].id;
      if (!pid) { res.status(200).json({ ok: false, error: "principal 없음" }); return; }
      const kstNow = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const since = new Date(new Date(`${kstNow}T00:00:00+09:00`).getTime() - (days - 1) * 86400000).toISOString();
      const rowsF = await fetch(`${SB_URL}/rest/v1/tasks?principal_id=eq.${pid}`
        + `&created_at=gte.${encodeURIComponent(since)}`
        + `&select=id,created_at,status,category_data,payments(principal_amount,track)&limit=5000`, { headers: H }).then(r => r.json());
      const byDay = {};
      const byHour = Array.from({ length: 24 }, (_, i) => ({ h: i, n: 0, done: 0, cancel: 0, visit: 0 }));
      const DONE = new Set(["완료", "부분완료", "completed", "partial"]);
      const CANC = new Set(["취소", "canceled"]);
      const VISI = new Set(["출장비만", "visit_only"]);
      for (const t2 of (Array.isArray(rowsF) ? rowsF : [])) {
        const kd = new Date(new Date(t2.created_at).getTime() + 9 * 3600 * 1000);
        const d = kd.toISOString().slice(0, 10);
        const hh = kd.getUTCHours();                       // +9h 시킨 값이라 이게 KST 시(時)
        const b = byDay[d] || (byDay[d] = { day: d, n: 0, st: {}, cr: {}, paidN: 0, amt: 0, h: new Array(24).fill(0) });
        b.n++;
        b.h[hh]++;
        const s = t2.status == null ? "(없음)" : String(t2.status);
        b.st[s] = (b.st[s] || 0) + 1;
        const H24 = byHour[hh];
        H24.n++;
        if (DONE.has(s)) H24.done++;
        else if (CANC.has(s)) H24.cancel++;
        else if (VISI.has(s)) H24.visit++;
        if (s === "취소" || s === "canceled") {
          const cd = t2.category_data || {};
          const raw = cd.cancelReason || "";
          const cr = raw ? String(raw).slice(0, 24) : "(사유없음)";
          b.cr[cr] = (b.cr[cr] || 0) + 1;
        }
        const ps = Array.isArray(t2.payments) ? t2.payments : [];
        const sum = ps.reduce((x, y) => x + (Number(y && y.principal_amount) || 0), 0);
        if (sum > 0) { b.paidN++; b.amt += sum; }
      }
      const rows = Object.values(byDay).sort((a, b) => a.day < b.day ? 1 : -1);
      res.status(200).json({ ok: true, days, total: (rowsF || []).length, rows, hours: byHour });
      return;
    }

    // 기사별 회사 마진 (?engmargin=1&days=N) — "원청(우리)이 기사에게서 매일 얼마 버나"
    // 7/29 추가: 광고비 대신 기사 직접 보상을 검토하려면 완료건당 회사 마진 실측이 먼저 필요하다.
    //  payments.owner_amount = 완료 작업 1건이 회사에 남기는 돈(기사정산·원청수수료 뺀 값).
    if (req.query.engmargin) {
      if (tk !== TOKEN_FULL && tk !== WRITE_TOKEN && (req.query.wt || "") !== WRITE_TOKEN) { res.status(404).end(); return; }
      const days = Math.min(60, Math.max(1, Number(req.query.days || 7)));
      const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
      const pr = await fetch(`${SB_URL}/rest/v1/principals?code=eq.allday&select=id`, { headers: H }).then(r => r.json());
      const pid = pr && pr[0] && pr[0].id;
      if (!pid) { res.status(200).json({ ok: false, error: "principal 없음" }); return; }
      const kstNow = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const since = new Date(new Date(`${kstNow}T00:00:00+09:00`).getTime() - (days - 1) * 86400000).toISOString();
      const rowsE = await fetch(`${SB_URL}/rest/v1/tasks?principal_id=eq.${pid}`
        + `&completed_at=gte.${encodeURIComponent(since)}`
        + `&status=eq.완료`
        + `&select=id,completed_at,assigned_engineer_id,payments(engineer_amount,principal_amount,owner_amount)&limit=5000`, { headers: H }).then(r => r.json());
      const rows = Array.isArray(rowsE) ? rowsE : [];
      const engIds = [...new Set(rows.map(r => r.assigned_engineer_id).filter(Boolean))];
      let nameMap = {};
      if (engIds.length) {
        const us = await fetch(`${SB_URL}/rest/v1/users?id=in.(${engIds.join(",")})&select=id,name`, { headers: H }).then(r => r.json());
        for (const u of (Array.isArray(us) ? us : [])) nameMap[u.id] = u.name || u.id;
      }
      const byEng = {};
      const byDay = {};
      let sumOwner = 0, sumEngineer = 0, sumPrincipal = 0, n = 0;
      for (const t2 of rows) {
        const ps = Array.isArray(t2.payments) ? t2.payments : [];
        const owner = ps.reduce((x, y) => x + (Number(y && y.owner_amount) || 0), 0);
        const eng   = ps.reduce((x, y) => x + (Number(y && y.engineer_amount) || 0), 0);
        const princ = ps.reduce((x, y) => x + (Number(y && y.principal_amount) || 0), 0);
        if (owner === 0 && eng === 0 && princ === 0) continue; // 정산 미확정 건 제외
        n++; sumOwner += owner; sumEngineer += eng; sumPrincipal += princ;
        const name = nameMap[t2.assigned_engineer_id] || "(미배정)";
        const eb = byEng[name] || (byEng[name] = { name, n: 0, owner: 0 });
        eb.n++; eb.owner += owner;
        const d = new Date(new Date(t2.completed_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        const db = byDay[d] || (byDay[d] = { day: d, n: 0, owner: 0 });
        db.n++; db.owner += owner;
      }
      res.status(200).json({
        ok: true, days, n,
        sum: { owner: sumOwner, engineer: sumEngineer, principal: sumPrincipal },
        perTask: n ? Math.round(sumOwner / n) : 0,
        byEngineer: Object.values(byEng).sort((a, b) => b.owner - a.owner),
        byDay: Object.values(byDay).sort((a, b) => a.day < b.day ? 1 : -1),
      });
      return;
    }

    // 부정클릭 감시: 최근 클릭 로그 IP 집계 (+ ?ip=x.x.x.x 시간대 상세)
    if (req.query.clicks) {
      if (req.query.ip) {
        const r = await fetch(`${SB_URL}/rest/v1/ad_click_log?ip=eq.${encodeURIComponent(req.query.ip)}&order=ts.desc&limit=100&select=ts,qs,ref`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
        const list = r.ok ? await r.json() : [];
        // IP 위치 조회 (시군구 수준 · 휴대폰 IP는 통신사 관문 위치라 부정확할 수 있음)
        let geo = null;
        try {
          const g = await fetch(`http://ip-api.com/json/${encodeURIComponent(req.query.ip)}?lang=ko&fields=status,country,regionName,city,isp,mobile`);
          const gj = await g.json();
          if (gj && gj.status === "success") geo = { region: koPlace(gj.regionName), city: koPlace(gj.city), isp: koIsp(gj.isp), mobile: !!gj.mobile };
        } catch (e) {}
        res.status(200).json({ ok: true, ip: req.query.ip, geo,
          rows: list.map(c => ({ ts: c.ts,
            ad: (c.qs || "").includes("n_") || (c.ref || "").includes("naver"),
            kw: (() => { try { const m = /n_(?:keyword|query)=([^&]+)/.exec(c.qs || ""); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } })() })) });
        return;
      }
      const rows = await sbGetLog();
      res.status(200).json({ ok: true, ...rows });
      return;
    }

    // 키워드 이력: 입찰가 변동 그래프 재료
    if (req.query.hist) {
      const rows = await sbGet("kw=eq." + encodeURIComponent(req.query.hist)
        + "&order=run_at.asc&limit=500");
      res.status(200).json({ ok: true, rows });
      return;
    }
    // ① 그룹 + 살아있는 키워드
    const groups = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
    const rows = [];
    for (const g of groups) {
      const list = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
      for (const k of (Array.isArray(list) ? list : [])) {
        if ((k.bidAmt || 0) > 70) {
          rows.push({ id: k.nccKeywordId, kw: k.keyword, grp: g.name, gid: g.nccAdgroupId,
            bid: k.bidAmt, on: !k.userLock, st: k.status });
        }
      }
    }

    // ② 오늘 성과 (키워드 단위)
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const fields = encodeURIComponent(JSON.stringify(["impCnt","clkCnt","salesAmt","avgRnk","ccnt"]));
    const tr = encodeURIComponent(JSON.stringify({ since: today, until: today }));
    const statMap = new Map();
    for (const part of chunk(rows, 100)) {
      const qs = part.map(r2 => "ids=" + encodeURIComponent(r2.id)).join("&")
        + "&fields=" + fields + "&timeRange=" + tr;
      try {
        const s = await call("GET", "/stats", qs);
        for (const d of (s && s.data || [])) statMap.set(d.id, d);
      } catch (e) { /* 통계 실패해도 표는 살린다 */ }
    }

    // ③ 모바일 1위가
    const estMap = new Map();
    for (const part of chunk(rows, 100)) {
      try {
        const r2 = await call("POST", "/estimate/average-position-bid/keyword", null, {
          device: "MOBILE", items: part.map(k => ({ key: k.kw, position: 1 })),
        });
        for (const e of (r2 && r2.estimate || [])) {
          const kk = e.keyword ?? e.key;
          if (kk != null) estMap.set(norm(kk), e.bid);
        }
      } catch (e) { /* skip */ }
    }

    for (const r2 of rows) {
      const s = statMap.get(r2.id) || {};
      r2.imp = s.impCnt || 0; r2.clk = s.clkCnt || 0; r2.conv = s.ccnt || 0;
      r2.cost = Math.round((s.salesAmt || 0) * 1.1);
      r2.rnk = s.avgRnk || null;
      r2.top1 = estMap.get(norm(r2.kw)) ?? null;
    }
    // 월 검색량 조인
    try {
      const vr = await fetch(`${SB_URL}/rest/v1/ad_kw_volume?select=kw,vol_total,vol_mobile`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: "0-2000" } });
      if (vr.ok) {
        const vols = await vr.json();
        const vmap = new Map(vols.map(v => [norm(v.kw), v.vol_total]));
        for (const r2 of rows) r2.vol = vmap.get(norm(r2.kw)) ?? null;
      }
    } catch (e) {}

    // 오늘 실제 접수 (올데이케어 = 자체유입) — 관리 토큰 소지자에게만 (수익 정보)
    let todayJobs = null;
    try {
      if (tk !== TOKEN_FULL && tk !== WRITE_TOKEN && (req.query.wt || "") !== WRITE_TOKEN) throw new Error("viewer");
      const kstDay = today; // KST YYYY-MM-DD
      const startISO = new Date(`${kstDay}T00:00:00+09:00`).toISOString();
      const endISO   = new Date(`${kstDay}T23:59:59+09:00`).toISOString();
      const pr = await fetch(`${SB_URL}/rest/v1/principals?code=eq.allday&select=id`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then(r => r.json());
      const pid = pr && pr[0] && pr[0].id;
      if (pid) {
        const cr = await fetch(`${SB_URL}/rest/v1/tasks?principal_id=eq.${pid}`
          + `&created_at=gte.${encodeURIComponent(startISO)}&created_at=lt.${encodeURIComponent(endISO)}&select=id`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
            Prefer: "count=exact", Range: "0-0" } });
        const cRange = cr.headers.get("content-range");
        if (cRange && cRange.includes("/")) todayJobs = Number(cRange.split("/")[1]);
      }
    } catch (e) {}

    // 키워드별 마지막 입찰 조정 시각
    try {
      const logs = await sbGet("kw=neq._run&order=run_at.desc&limit=2000&select=kw,run_at");
      const lmap = new Map();
      for (const l of logs) { const k = norm(l.kw); if (!lmap.has(k)) lmap.set(k, l.run_at); }
      for (const r2 of rows) r2.lastBid = lmap.get(norm(r2.kw)) || null;
    } catch (e) {}

    // 자동맞춤 최근 실행 (생존 신호)
    let lastRun = null;
    try {
      const lr = await sbGet("kw=eq._run&order=run_at.desc&limit=1");
      if (lr && lr[0]) lastRun = { at: lr[0].run_at, watched: lr[0].bid_from,
        changed: lr[0].bid_to, capped: lr[0].est1 };
    } catch (e) {}
    // 실측 순위 (30분마다 검색결과 확인 — 핵심 10개)
    let serp = null;
    try {
      const sr = await fetch(`${SB_URL}/rest/v1/ad_serp_rank?select=kw,rank,ads_total,rival,blocked,ts&order=ts.desc&limit=10`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      if (sr.ok) {
        const list = await sr.json();
        serp = {};
        for (const r2 of list) if (!(r2.kw in serp)) serp[r2.kw] = { rank: r2.rank, ads: r2.ads_total, rival: r2.rival, at: r2.ts, blocked: r2.blocked };
      }
    } catch (e) {}
    res.status(200).json({ ok: true, at: new Date().toISOString(), today, count: rows.length, lastRun, todayJobs, serp, rows });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
