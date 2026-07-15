// ============================================================
// 2026-07-15 — 도로명주소 검색 API (행정안전부 juso.go.kr) 연동.
//
// 배경 (사장님 발견): "삼양로 69길 27"처럼 구 없이 도로명만 있는 주소는
//   사전 파서로 지역(구)을 못 뽑아 "삼양로"로 저장 → 기사 매칭/지도 실패.
//   → 정부 무료 주소 API로 주소 → 시군구를 실시간 해석.
//
// 방식: JSONP (addrLinkApiJsonp.do) — 브라우저에서 직접 호출, 서버 불필요.
//   승인키(confmKey)는 신청 도메인에 묶인 공개용 키 (JSONP 설계상 노출 전제).
//
// 사용: resolveAddressDistrict("삼양로 69길 27")
//   → { ok: true, sido: "서울특별시", sgg: "강북구", full: "서울특별시 강북구 삼양로69길 27" }
//   → 실패/무결과/타임아웃: { ok: false }  (호출부는 수동 선택으로 fallback)
// ============================================================

import { JUSO_CONFM_KEY } from "../config/jusoKey.js";

const JSONP_URL = "https://business.juso.go.kr/addrlink/addrLinkApiJsonp.do";
const TIMEOUT_MS = 4000;

let _seq = 0;

// JSONP 호출 헬퍼 — script 태그 주입 + 전역 콜백 + 타임아웃 정리.
function _jsonp(params) {
  return new Promise((resolve) => {
    const cbName = `__jusoCb_${Date.now()}_${_seq++}`;
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      try { delete window[cbName]; } catch (_e) { window[cbName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve(null);
    }, TIMEOUT_MS);

    window[cbName] = (data) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };

    const qs = new URLSearchParams({ ...params, callback: cbName }).toString();
    script.src = `${JSONP_URL}?${qs}`;
    document.head.appendChild(script);
  });
}

// 주소 문자열 → 시군구 해석.
//   sgg: "강북구" / "부천시" / "고양시 덕양구"→"덕양구" (구가 있으면 구 우선 — 기사 매칭 단위)
export async function resolveAddressDistrict(keyword) {
  const kw = String(keyword || "").trim();
  if (!JUSO_CONFM_KEY) return { ok: false, reason: "no_key" };
  if (kw.length < 4) return { ok: false, reason: "too_short" };

  try {
    const data = await _jsonp({
      confmKey: JUSO_CONFM_KEY,
      currentPage: "1",
      countPerPage: "1",
      keyword: kw,
      resultType: "json",
    });
    const errCode = data?.results?.common?.errorCode;
    const juso = data?.results?.juso;
    if (errCode !== "0" || !Array.isArray(juso) || juso.length === 0) {
      return { ok: false, reason: errCode || "no_result" };
    }
    const hit = juso[0];
    const sido = String(hit.siNm || "").trim();
    const sggRaw = String(hit.sggNm || "").trim();          // "강북구" / "고양시 덕양구"
    if (!sggRaw) return { ok: false, reason: "no_sgg" };
    const parts = sggRaw.split(/\s+/);
    const last = parts[parts.length - 1];
    const sgg = /구$/.test(last) ? last : parts[0];         // 구 우선, 없으면 시/군
    return { ok: true, sido, sgg, sggFull: sggRaw, full: hit.roadAddr || "" };
  } catch (e) {
    console.warn("[jusoApi] 해석 실패:", e?.message || e);
    return { ok: false, reason: "exception" };
  }
}
