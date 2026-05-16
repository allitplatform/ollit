// Step 5-8 — 회사 계좌 양방향 sync (Step 5-2/5-3 패턴 동일)
// Phase 3-7 (2026-05-13) — 시트 호출 폐기. DB 직접 사용 (src/lib/companyAccountDb.js).
//   - 저장소: tenants.settings.company_account (jsonb) — 마이그레이션 0개
//   - 함수 시그니처 / 응답 형태 유지 — 외부 호출처 (CompanyAccountScreen, EngineerSettleTab) 변경 0
// 권한: 변경 = owner / admin (PERMISSIONS["menu.company_account"])
// 조회 = 모든 사용자 (기사 정산 화면 / 회사 송금 표시)

import {
  getCompanyAccountFromDb,
  saveCompanyAccountToDb,
} from "../lib/companyAccountDb.js";
import { todayYmd } from "../utils/dateLabel.js";

const STORAGE_KEY  = "ollit_company_account_v1";       // 옛 측 (사장님이 화면에서 박은 마지막 값)
const SHEET_CACHE_KEY = "ollit_company_account_cache_v1"; // 시트 fetch 결과 캐시

// 시트 측 데이터 없을 때 fallback default (운영 시작 전 / 시트 미배포 catch)
// 사장님이 시트에 박으면 이 값은 무시되고 시트 우선.
const DEFAULT_COMPANY_ACCOUNT = {
  bankName:      "우리은행",
  accountNumber: "1002-XXX-XXXXXX",
  accountHolder: "올데이케어",
  changedAt:     "",
};

// 시트 행 → 코드 모델 (다양한 키 호환)
function _adaptSheetCompanyAccount(raw) {
  if (!raw) return null;
  // key-value 시트 형식 — A열 항목 / B열 값
  // GAS 측에서 객체로 변환해 반환 가정: { 회사_계좌번호, 회사_은행명, 회사_예금주, 회사_계좌_변경일 }
  // 또는 영어 키: { accountNumber, bankName, accountHolder, changedAt }
  const bankName      = raw.bankName      || raw.회사_은행명     || raw.은행명     || "";
  const accountNumber = raw.accountNumber || raw.회사_계좌번호   || raw.계좌번호   || "";
  const accountHolder = raw.accountHolder || raw.회사_예금주     || raw.예금주     || "";
  const changedAt     = raw.changedAt     || raw.회사_계좌_변경일 || raw.변경일     || "";
  if (!bankName && !accountNumber && !accountHolder) return null;
  return { bankName, accountNumber, accountHolder, changedAt };
}

// 시트 fetch 캐시 (AdminApp 등에서 호출 후 박힘)
export function setCompanyAccountCache(data) {
  if (!data || typeof data !== "object") return;
  const adapted = _adaptSheetCompanyAccount(data) || data;
  try {
    localStorage.setItem(SHEET_CACHE_KEY, JSON.stringify(adapted));
  } catch (e) { /* */ }
}

export function getCompanyAccountCache() {
  try {
    const raw = localStorage.getItem(SHEET_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) { /* */ }
  return null;
}

// 옛 측 localStorage (운영자가 화면에서 박은 마지막 값 / 시트 빈 상태 catch)
function _loadLocalCompanyAccount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) { /* */ }
  return null;
}

function _saveLocalCompanyAccount(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* */ }
}

// 우선순위: 시트 캐시 > 옛 측 localStorage > 기본값
export function loadCompanyAccount() {
  const sheet = getCompanyAccountCache();
  if (sheet && (sheet.bankName || sheet.accountNumber)) return sheet;
  const local = _loadLocalCompanyAccount();
  if (local && (local.bankName || local.accountNumber)) return local;
  return { ...DEFAULT_COMPANY_ACCOUNT };
}

// DB read → 캐시 갱신 (AdminApp/EngineerApp 부팅 시 호출)
// Phase 3-7 — tenants.settings.company_account 직접 조회. 응답 형태 동일.
export async function fetchCompanyAccount() {
  try {
    const res = await getCompanyAccountFromDb();
    if (!res || res.ok === false) return null;
    const data = res.account;
    if (!data) return null;
    const adapted = _adaptSheetCompanyAccount(data);
    if (adapted) {
      setCompanyAccountCache(adapted);
      return adapted;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// payload: { bankName, accountNumber, accountHolder, changedAt? }
// localStorage 즉시 + GAS sync (실패 시 localOk: true)
export async function saveCompanyAccountWithSync(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload 누락", localOk: false };
  }
  const today = todayYmd();
  const data = {
    bankName:      String(payload.bankName      || "").trim(),
    accountNumber: String(payload.accountNumber || "").trim(),
    accountHolder: String(payload.accountHolder || "").trim(),
    changedAt:     payload.changedAt || today,
  };
  if (!data.bankName || !data.accountNumber || !data.accountHolder) {
    return { ok: false, error: "필수 항목 누락 (은행 / 번호 / 예금주)", localOk: false };
  }

  // 1) 옛 측 localStorage 즉시 + 캐시 즉시 (UI 응답성)
  _saveLocalCompanyAccount(data);
  setCompanyAccountCache(data);

  // 2) DB sync (Phase 3-7 — tenants.settings.company_account 갱신)
  try {
    const res = await saveCompanyAccountToDb(data);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "DB sync 실패");
    }
    return { ok: true, action: res.action || "update" };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}
