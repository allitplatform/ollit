// Supabase 클라이언트 (PWA 측 — anon key only)
// 서버/스크립트는 service_role key 직접 사용 (별도 모듈 가능)

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase 환경변수 누락: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env.local 확인)"
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,        // 30일 토큰 ("이 기기 기억")
    autoRefreshToken: true,
    detectSessionInUrl: false,   // OAuth 콜백 X (전화+PIN 흐름)
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "allit.auth",    // 로컬스토리지 키 namespace
  },
});
