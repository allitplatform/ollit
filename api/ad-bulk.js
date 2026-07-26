// 2026-07-26 v3 — 확장 키워드 대량 등록 (작업 후 삭제).
// 방침(사장님): "에어컨 관련은 노출 다 돼도 좋다. 입찰가는 낮게."
// 하는 일:
//   ?step=plan   → 키워드도구에서 후보 수집 → 우리 일 관련만 분류 → 등록 예정 목록 미리보기 (쓰기 없음)
//   ?step=group  → 새 광고그룹 '확장_증상청소' 생성 (메인키워드 그룹의 채널 복제)
//   ?step=add&gid=grp-... → 후보 상위 100개를 그 그룹에 입찰가 2,000원으로 등록
//   ?check=1     → 새 그룹 현재 상태 재조회

import crypto from "crypto";

const NAVER_API_KEY  = process.env.NAVER_AD_API_KEY;
const NAVER_SECRET   = process.env.NAVER_AD_SECRET;
const NAVER_CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID;
const NAVER_BASE     = "https://api.searchad.naver.com";
const TOKEN = "7d1d70eb28b87512ab6ad1b308991dcce3a706749f30611c";

const CAMPAIGN_ID = "cmp-a001-01-000000010808110";
const MAIN_GROUP  = "메인키워드";           // 채널 복제 원본
const NEW_GROUP_NAME = "확장_증상청소";
const BID = 2000;
const SEEDS = [
  ["에어컨청소","벽걸이에어컨청소","에어컨냄새제거","에어컨수리","에어컨실외기"],
  ["에어컨필터청소","에어컨가스","에어컨냉매","시스템에어컨청소","에어컨물떨어짐"],
];

// 분류 — MarketingScreen 과 동일 + 자동차/셀프 제외 강화
const KW_EXCL = /(자동차|차량|버스|트럭|화물|캠핑|셀프|추천|구입|구매|렌탈|렌털|중고|판매|매장|가격비교|신제품|얼마|스탠드형|리모컨|사용법|전기세|평수|보관|이사)/;
const KW_ASC  = /(서비스센터|as센터|무상|보증|as$|as[^a-z0-9가-힣]|삼성전자|엘지전자|에어컨as)/i;
const KW_WORK = /(충전|냉매|가스|청소|세척|수리|고장|안시원|시원하지|안나와|안나옴|안됨|물떨어|누수|냄새|곰팡이|점검|실외기|필터|얼음|결빙|에러|안돌아|약해|냉방|배수|드레인|살균|분해)/;

function qcNum(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").replace(/[^0-9]/g, "");
  return s ? Number(s) : 5;
}

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
  return { status: r.status, ok: r.ok, data };
}

async function collectCandidates() {
  // ① 키워드도구 2회
  const seen = new Map();
  for (const pack of SEEDS) {
    const r = await call("GET", "/keywordstool",
      "hintKeywords=" + encodeURIComponent(pack.join(",")) + "&showDetail=1");
    const list = r.data && r.data.keywordList || [];
    for (const k of list) {
      const kw = String(k.relKeyword || "").replace(/\s+/g, "");
      if (!kw || seen.has(kw)) continue;
      seen.set(kw, qcNum(k.monthlyPcQcCnt) + qcNum(k.monthlyMobileQcCnt));
    }
  }
  // ② 우리 일 관련만
  let cand = [...seen.entries()]
    .filter(([kw]) => !KW_EXCL.test(kw) && !KW_ASC.test(kw) && KW_WORK.test(kw))
    .sort((a, b) => b[1] - a[1]);
  // ③ 이미 등록된 단어 제외 (메인키워드 그룹만 — 지역조합 그룹과는 충돌 안 함)
  const ag = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
  const groups = Array.isArray(ag.data) ? ag.data : [];
  const main = groups.find(g => g.name === MAIN_GROUP);
  const existing = new Set();
  if (main) {
    const ks = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(main.nccAdgroupId));
    for (const k of (Array.isArray(ks.data) ? ks.data : [])) existing.add(String(k.keyword).replace(/\s+/g, ""));
  }
  const done = groups.find(g => g.name === NEW_GROUP_NAME);
  if (done) {
    const ks = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(done.nccAdgroupId));
    for (const k of (Array.isArray(ks.data) ? ks.data : [])) existing.add(String(k.keyword).replace(/\s+/g, ""));
  }
  cand = cand.filter(([kw]) => !existing.has(kw)).slice(0, 100);
  return { cand, groups, main, done };
}

export default async function handler(req, res) {
  if ((req.query.token || "") !== TOKEN) { res.status(404).end(); return; }
  try {
    const step = req.query.step || "";

    if (req.query.check) {
      const ag = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
      const g = (Array.isArray(ag.data) ? ag.data : []).find(x => x.name === NEW_GROUP_NAME);
      if (!g) { res.status(200).json({ ok: false, error: "새 그룹 없음" }); return; }
      const ks = await call("GET", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(g.nccAdgroupId));
      const rows = Array.isArray(ks.data) ? ks.data : [];
      res.status(200).json({ ok: true, group: g.nccAdgroupId, total: rows.length,
        sample: rows.slice(0, 10).map(k => ({ kw: k.keyword, bid: k.bidAmt, status: k.status })) });
      return;
    }

    if (step === "plan") {
      const { cand, main, done } = await collectCandidates();
      res.status(200).json({ ok: true, mode: "plan",
        mainFound: !!main, newGroupExists: !!done,
        count: cand.length,
        totalVol: cand.reduce((a, b) => a + b[1], 0),
        top30: cand.slice(0, 30).map(([kw, v]) => ({ kw, vol: v })) });
      return;
    }

    if (step === "group") {
      const ag = await call("GET", "/ncc/adgroups", "nccCampaignId=" + encodeURIComponent(CAMPAIGN_ID));
      const groups = Array.isArray(ag.data) ? ag.data : [];
      const exist = groups.find(g => g.name === NEW_GROUP_NAME);
      if (exist) { res.status(200).json({ ok: true, gid: exist.nccAdgroupId, note: "이미 있음" }); return; }
      const main = groups.find(g => g.name === MAIN_GROUP);
      if (!main) { res.status(200).json({ ok: false, error: "메인키워드 그룹 못 찾음" }); return; }
      const r = await call("POST", "/ncc/adgroups", null, {
        nccCampaignId: CAMPAIGN_ID,
        name: NEW_GROUP_NAME,
        pcChannelId: main.pcChannelId,
        mobileChannelId: main.mobileChannelId,
        bidAmt: BID, useDailyBudget: false,
      });
      res.status(200).json({ ok: r.ok, gid: r.data && r.data.nccAdgroupId, err: r.ok ? null : r.data });
      return;
    }

    if (step === "add") {
      const gid = req.query.gid;
      if (!gid) { res.status(200).json({ ok: false, error: "gid 필요" }); return; }
      const { cand } = await collectCandidates();
      const bodyArr = cand.map(([kw]) => ({ keyword: kw, bidAmt: BID, useGroupBidAmt: false }));
      if (!bodyArr.length) { res.status(200).json({ ok: true, created: 0, note: "후보 없음(이미 등록됨)" }); return; }
      const r = await call("POST", "/ncc/keywords", "nccAdgroupId=" + encodeURIComponent(gid), bodyArr);
      res.status(200).json({ ok: r.ok,
        created: Array.isArray(r.data) ? r.data.length : 0,
        err: r.ok ? null : r.data });
      return;
    }

    res.status(200).json({ ok: true, steps: ["plan", "group", "add&gid=", "check=1"] });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
