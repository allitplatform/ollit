# -*- coding: utf-8 -*-
# 추천 기사 지역 매칭 — 동 단위 주소를 구/시로 승격 (regionParser 연결)
import io, sys

ROOT = "/sessions/rcw-01u4et6pwfchupgdzvaelxyk/mnt/ollit/"

def patch(path, pairs):
    p = ROOT + path
    s = io.open(p, encoding="utf-8").read()
    before = len(s)
    for old, new, cnt in pairs:
        n = s.count(old)
        if n != cnt:
            print("FAIL %s expect=%d got=%d\n---\n%s" % (path, cnt, n, old[:150])); sys.exit(1)
        s = s.replace(old, new)
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("OK %s (%d -> %d)" % (path, before, len(s)))


E = "src/utils/engineerRecommendation.js"

# [1] import + 헬퍼
e1_old = '''import { normalizeZoneName, zoneCoversRegion } from "../data/engineers.js";
import { supabase } from "../lib/supabase.js";'''
e1_new = '''import { normalizeZoneName, zoneCoversRegion } from "../data/engineers.js";
// 2026-07-26 — 동 단위 주소 → 구/시 승격 (사장님 spec: "세부 동으로 들어오면
//   지도 쳐서 구 찾아 다시 검색하는 게 불편"). 지역별 접수 현황과 같은 파서 재사용
//   (동 사전 + 공백 없는 주소 + 세분구 처리 전부 포함).
import { parseRegion } from "./regionParser.js";
import { supabase } from "../lib/supabase.js";

// task 의 지역 후보 목록 — [원래 region, 파서가 뽑은 구/시].
//   주소 전체를 파서에 넣는 게 정확 (region 은 주소 첫 단어라 동일 수 있음).
//   주소가 없으면 region 문자열 자체를 파싱 ("죽전동" → 용인시).
export function resolveRegionCandidates(region, address) {
  const out = [];
  const r = String(region || "").trim();
  if (r) out.push(r);
  const src = String(address || "").trim() || r;
  if (src) {
    const p = parseRegion(src);
    if (p && p.sigungu && !out.includes(p.sigungu)) out.push(p.sigungu);
  }
  return out;
}'''

# [2] matchSkill — 옛 sync 경로 (AllEngineersModal 등)
e2_old = '''  const r  = task?.region ? String(task.region).trim() : "";'''
e2_new = '''  // 2026-07-26 — 동 단위 지역 승격: region + 주소 파싱 구/시 를 함께 대조.
  const rCands = resolveRegionCandidates(task?.region, task?.fullAddress || task?.address);
  const r  = rCands.length > 0 ? rCands[0] : "";'''

e3_old = '''      const regionMatch = !r || isAllRegion
        || zones.some(z => zoneCoversRegion(z, r));   // 2026-07-20 — 시↔구 커버 포함'''
e3_new = '''      const regionMatch = rCands.length === 0 || isAllRegion
        || zones.some(z => rCands.some(c => zoneCoversRegion(z, c)));   // 2026-07-26 — 동→구 승격 포함'''

# [3] adapter — address 4번째 인자
e4_old = '''export async function recommendEngineersGroupedAdapter(workType, principal, region) {
  const list = await recommendEngineersFromDb({
    workType:  workType  || "",
    principal: principal || "",
    region:    region    || "",
  });'''
e4_new = '''export async function recommendEngineersGroupedAdapter(workType, principal, region, address) {
  const list = await recommendEngineersFromDb({
    workType:  workType  || "",
    principal: principal || "",
    region:    region    || "",
    address:   address   || "",   // 2026-07-26 — 동→구 승격용 (없으면 region 만으로 파싱)
  });'''

# [4] recommendEngineersFromDb — 후보 목록 매칭
e5_old = '''export async function recommendEngineersFromDb(task) {
  const region  = String(task?.region || "").trim();
  const svcCode = _pickServiceCode(task);'''
e5_new = '''export async function recommendEngineersFromDb(task) {
  const region  = String(task?.region || "").trim();
  // 2026-07-26 — 동 단위 승격: "죽전동" 접수 → ["죽전동","용인시"] 로 zones 대조.
  const rCands  = resolveRegionCandidates(task?.region, task?.address);
  const svcCode = _pickServiceCode(task);'''

e6_old = '''    const isAll = zones.length === 0 || zones.includes("전국");
    if (isAll || !region) {
      filtered.push({ ...c, regionHit: "all", zones });
      continue;
    }
    // 2026-07-20 — matchedZone 부착: RecommendCard 지역 줄이 비어 나오던 것
    //   (DB 후보에 cleanZones/matchedZone 없음 → infoText "") 표시 복구.
    const hit = zones.find(z => zoneCoversRegion(z, region));   // 2026-07-20 — 시↔구 커버 포함'''
e6_new = '''    const isAll = zones.length === 0 || zones.includes("전국");
    if (isAll || rCands.length === 0) {
      filtered.push({ ...c, regionHit: "all", zones });
      continue;
    }
    // 2026-07-20 — matchedZone 부착: RecommendCard 지역 줄이 비어 나오던 것
    //   (DB 후보에 cleanZones/matchedZone 없음 → infoText "") 표시 복구.
    const hit = zones.find(z => rCands.some(c2 => zoneCoversRegion(z, c2)));   // 2026-07-26 — 동→구 승격 포함'''

patch(E, [(e1_old, e1_new, 1), (e2_old, e2_new, 1), (e3_old, e3_new, 1),
          (e4_old, e4_new, 1), (e5_old, e5_new, 1), (e6_old, e6_new, 1)])


# [5] AdminApp 호출부 2곳 — address 전달
A = "src/pages/AdminApp.jsx"
a1_old = '''        const res = await recommendEngineersGroupedAdapter(mainWorkType, principal, region);'''
a1_new = '''        const res = await recommendEngineersGroupedAdapter(mainWorkType, principal, region, task.fullAddress || task.address || "");'''
patch(A, [(a1_old, a1_new, 2)])
