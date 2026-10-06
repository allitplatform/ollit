// 2026-10-06 Mig 212~214 — 협력사(subcontractors) 공용 모듈.
//   · 원청(principals)과 별개 개념. 코드의 'partner' 는 원청 담당자이므로 여기서는 쓰지 않는다.
//   · 이름표 / 소속 기사 색인 = 화면 표시·추천 제외용 (민감 정보 없음).
//   · 관리 기능(운영자) / 협력사 관리자 기능 = 전부 RPC + 세션 값 (서버에서 소속 확인).
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { getSessionAuth } from "./auth.js";

const NEED_LOGIN = "보안 확인이 필요합니다. 로그아웃 후 다시 로그인해 주세요.";

// ── 색인 (모듈 캐시) ─────────────────────────────────────────
//   names:  Map<subcontractorId, { id, code, name, active }>
//   byUserId / byCode / byName: 소속 기사 → subcontractorId
const EMPTY_INDEX = { ready: false, names: new Map(), byUserId: new Map(), byCode: new Map(), byName: new Map(), roleByUserId: new Map() };
let _index = EMPTY_INDEX;
let _promise = null;
const _listeners = new Set();

async function _load() {
  const names = new Map();
  const byUserId = new Map(), byCode = new Map(), byName = new Map(), roleByUserId = new Map();
  try {
    const { data } = await supabase.rpc("list_subcontractor_names");
    for (const s of Array.isArray(data) ? data : []) names.set(s.id, s);
  } catch (_e) { /* 212 이전 DB — 빈 색인으로 동작 */ }
  try {
    const { data } = await supabase
      .from("users")
      .select("id, code, name, subcontractor_id, sub_role")
      .not("subcontractor_id", "is", null);
    for (const u of data || []) {
      byUserId.set(u.id, u.subcontractor_id);
      roleByUserId.set(u.id, u.sub_role || "staff");
      if (u.code) byCode.set(u.code, u.subcontractor_id);
      if (u.name) byName.set(u.name, u.subcontractor_id);
    }
  } catch (_e) { /* 빈 색인 */ }
  _index = { ready: true, names, byUserId, byCode, byName, roleByUserId };
  for (const fn of _listeners) { try { fn(_index); } catch (_e) { /* 무시 */ } }
  return _index;
}

export function loadSubcontractorIndex(force = false) {
  if (force) _promise = null;
  if (!_promise) _promise = _load();
  return _promise;
}

export function getSubcontractorIndex() { return _index; }

// 화면용 훅 — 색인이 준비되면 다시 그린다.
export function useSubcontractorIndex() {
  const [idx, setIdx] = useState(_index);
  useEffect(() => {
    _listeners.add(setIdx);
    loadSubcontractorIndex().then(setIdx);
    return () => { _listeners.delete(setIdx); };
  }, []);
  return idx;
}

// 기사 객체(여러 형태)가 협력사 소속이면 그 협력사 id, 아니면 null.
export function subcontractorOfEngineer(eng, idx = _index) {
  if (!eng) return null;
  if (typeof eng === "string") {
    return idx.byUserId.get(eng) || idx.byCode.get(eng) || idx.byName.get(eng) || null;
  }
  return (eng.subcontractorId || eng.subcontractor_id)
    || idx.byUserId.get(eng.userId) || idx.byUserId.get(eng.user_id)
    || idx.byCode.get(eng.engineerId) || idx.byCode.get(eng.id) || idx.byCode.get(eng.code)
    || idx.byName.get(eng.name)
    || null;
}

export function subcontractorName(subId, idx = _index) {
  if (!subId) return "";
  return idx.names.get(subId)?.name || "협력사";
}

// 작업 담당 표기 — "화이트코어 · 직원명" / "화이트코어 · 직원 미정" / (직영이면 "")
export function subcontractorAssigneeLabel(task, idx = _index) {
  const subId = task?.subcontractorId || task?.subcontractor_id;
  if (!subId) return "";
  const eng = String(task.assignedEngineer || task.engineer || "").trim();
  return `${subcontractorName(subId, idx)} · ${eng || "직원 미정"}`;
}

// 목록 카드용 담당 이름 — 협력사 작업이면 "화이트코어 · 직원명"(직원 없으면 "직원 미정"),
//   직영이면 기사 이름 그대로(없으면 emptyText).
export function engineerDisplayName(task, emptyText = "") {
  if (!task) return emptyText;
  const subId = task.subcontractorId || task.subcontractor_id;
  if (subId) return subcontractorAssigneeLabel(task, _index);
  return String(task.assignedEngineer || task.engineer || "").trim() || emptyText;
}

// ── RPC 공용 ─────────────────────────────────────────────────
async function _call(fn, args) {
  const { actor, token } = getSessionAuth();
  if (!actor || !token) return { ok: false, error: NEED_LOGIN };
  const { data, error } = await supabase.rpc(fn, { p_actor: actor, p_token: token, ...args });
  if (error) {
    console.error(`[subcontractorsDb.${fn}]`, error);
    return { ok: false, error: error.message || "요청 실패" };
  }
  if (!data || data.ok === false) return { ok: false, error: (data && data.error) || "요청 실패" };
  return data;
}

// ── 운영자 ───────────────────────────────────────────────────
export const adminListSubcontractors = () => _call("admin_list_subcontractors", {});
export const adminUpsertSubcontractor = (id, patch) =>
  _call("admin_upsert_subcontractor", { p_id: id || null, p_patch: patch || {} });
export async function adminSetUserSubcontractor(userId, subcontractorId, subRole = "staff") {
  const res = await _call("admin_set_user_subcontractor", {
    p_user_id: userId, p_subcontractor_id: subcontractorId || null, p_sub_role: subRole,
  });
  if (res.ok) loadSubcontractorIndex(true);
  return res;
}
// subcontractorId = null 이면 직영으로 회수.
export const adminAssignTaskToSubcontractor = (taskId, subcontractorId) =>
  _call("admin_assign_task_to_subcontractor", { p_task_id: taskId, p_subcontractor_id: subcontractorId || null });

// ── 협력사 직원 (기사 앱) ─────────────────────────────────────
// 완료 직전 공급가액(부가세 제외) 저장. 부가세·합계는 서버가 계산해 돌려준다.
// 합계가 접수 견적보다 적으면 reason(사유) 필수 — 서버가 다시 확인한다.
export const subStaffSetSupply = (taskId, supply, reason = null) =>
  _call("sub_staff_set_supply", { p_task_id: taskId, p_supply: Math.round(Number(supply) || 0), p_reason: reason || null });

// ── 협력사 관리자 ────────────────────────────────────────────
export const subListStaff = () => _call("sub_list_staff", {});
export const subListTasks = (from = null, to = null) => _call("sub_list_tasks", { p_from: from, p_to: to });
// engineerId = null 이면 배정 해제.
export const subAssignTask = (taskId, engineerId) =>
  _call("sub_assign_task", { p_task_id: taskId, p_engineer_id: engineerId || null });
