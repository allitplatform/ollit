// V14 — phone + password 박은 영역 로그인 (Custom RPC 측 박은 영역)
// db/migrations/007_auth_setup.sql 측 sign_in_with_phone / change_password 박음.
// Phase 1 — Supabase Auth 박지 X / users 테이블 직접 박은 영역.
//
// 응답 구조:
//   signInWithPhone(phone, password)
//     → { ok: true, user_id, tenant_id, code, name, phone, email, roles[], must_change_password }
//     → { ok: false, error: 'user_not_found' | 'invalid_password' | ... }
//
//   changePassword(userId, oldPassword, newPassword)
//     → { ok: true } | { ok: false, error: 'invalid_old_password' | 'password_too_short' | ... }

import { supabase } from "./supabase.js";

const LS_KEY = "allit.user";

// 전화번호 정규화 — '-' / 공백 / '+' 제거. '010-9447-1547' → '01094471547'.
export function normalizePhone(phone) {
  return String(phone || "").replace(/[-\s+]/g, "");
}

export async function signInWithPhone(phone, password) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !password) {
    return { ok: false, error: "phone / password 필수" };
  }

  const { data, error } = await supabase.rpc("sign_in_with_phone", {
    p_phone: cleanPhone,
    p_password: password,
  });

  if (error) {
    console.error("[auth.signInWithPhone]", error);
    return { ok: false, error: error.message || "rpc_error" };
  }

  // RPC 응답 = jsonb (data 측 그대로 박힘)
  if (data && data.ok) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { console.error("[auth.signInWithPhone:ls]", e); }
  }
  return data || { ok: false, error: "empty_response" };
}

export async function changePassword(userId, oldPassword, newPassword) {
  if (!userId || !oldPassword || !newPassword) {
    return { ok: false, error: "필수 인자 누락" };
  }

  const { data, error } = await supabase.rpc("change_password", {
    p_user_id:      userId,
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });

  if (error) {
    console.error("[auth.changePassword]", error);
    return { ok: false, error: error.message || "rpc_error" };
  }

  if (data && data.ok) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        user.must_change_password = false;
        localStorage.setItem(LS_KEY, JSON.stringify(user));
      }
    } catch (e) { console.error("[auth.changePassword:ls]", e); }
  }
  return data || { ok: false, error: "empty_response" };
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function signOut() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
}

// 박은 영역 박은 영역 — role 박혀있나 헬퍼
export function hasRole(role) {
  const u = getCurrentUser();
  if (!u || !Array.isArray(u.roles)) return false;
  return u.roles.includes(role);
}
