// V14 v3 — 정산 메인 (Hero 64px + weight 600/700)
// 헌법 v3: weight 500 → 600 / 600 → 700 / Hero 사이즈 키움
// [verify-2026-05-04] dist에 fontSize:64,fontWeight:700 적용 확정

import { useState, useMemo } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { loadCompanyAccount } from "../data/companyAccount.js";

function getEarning(t) {
  return t.engineer_amount || 0;
}

function getRevenue(t) {
  // 사장님 spec: "기사 수익 제외 전체가 회사 수수료"
  // totalAmount = DB GENERATED (product + extra + travel + naver)
  // fallback: totalAmount 박지 X 박힐 spec 측 — product + extra + travel 합산
  return t.totalAmount ||
    (t.product_price || t.estimateTotal || 0) +
    (t.extra_fee || t.extraFee || 0) +
    (t.travel_fee || t.travelFee || 0);
}

// V14 v6 — 계좌 복사 (폴백 + 토스트 / 사장님 spec)
async function copyToClipboard(text, onToast, label = "계좌번호") {
  if (!text) {
    if (onToast) onToast("복사할 텍스트가 없습니다", "error");
    return;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // 폴백 (구형 브라우저 / 비-HTTPS)
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (onToast) onToast(`${label}이(가) 복사되었습니다`, "success");
  } catch (err) {
    console.error("[copyToClipboard] failed:", err);
    if (onToast) onToast("복사 실패. 직접 입력해주세요", "error");
  }
}

export function EngineerSettleTab({
  engineer,
  todayTasks = [],
  // 2026-05-18 Fix #30 D — 회사 송금 카드 전용 (트랙 🅐만). null이면 todayTasks fallback (옛 호환).
  toCompanyTasks = null,
  monthStats,
  usolN,
  companyAccount,
  toCompany,
  isPaymentSent = false,
  onClickToday,
  onClickUsolN,
  onClickPaymentHistory,
  onConfirmPaymentSent,
  onTabChange,
  unreadCount = 0,
}) {
  // V14 v6 — 토스트 state (계좌 복사 등)
  const [toast, setToast] = useState(null); // { message, type }
  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }
  // "오늘 번 돈" Hero — 기사 입장 전체 수익 (트랙 🅐+🅑 모두 포함)
  const completedToday = todayTasks.filter(t => t.status === "완료");
  const todayEarning   = completedToday.reduce((s, t) => s + getEarning(t), 0);
  const todayRevenue   = completedToday.reduce((s, t) => s + getRevenue(t), 0);

  // 2026-05-18 Fix #30 D — "회사 송금" 카드는 트랙 🅐만 (toCompanyTasks 별도, 없으면 옛 호환 fallback)
  const toCompanySource  = (toCompanyTasks || todayTasks).filter(t => t.status === "완료");
  const toCompanyRevenue = toCompanySource.reduce((s, t) => s + getRevenue(t), 0);
  const toCompanyEarning = toCompanySource.reduce((s, t) => s + getEarning(t), 0);
  const toCompanyFinal   = toCompany != null ? toCompany : Math.max(0, toCompanyRevenue - toCompanyEarning);

  // Step 5-8 F-6 — 회사 계좌 = 시트 양방향 sync (loadCompanyAccount)
  // companyAccount prop이 있으면 우선 / 없으면 시트 데이터 fallback / 없으면 기본값
  const account = useMemo(() => {
    if (companyAccount && (companyAccount.bankName || companyAccount.bank)) {
      return {
        company: companyAccount.accountHolder || companyAccount.company || "올데이케어",
        bank:    companyAccount.bankName      || companyAccount.bank    || "",
        number:  companyAccount.accountNumber || companyAccount.number  || "",
      };
    }
    const fromSheet = loadCompanyAccount();
    return {
      company: fromSheet.accountHolder || "올데이케어",
      bank:    fromSheet.bankName      || "",
      number:  fromSheet.accountNumber || "",
    };
  }, [companyAccount]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 — V14 v3: 24/700 */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{
          fontSize: 24, fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.4px",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>💰</span> 정산
        </div>
        <div style={{
          fontSize: 13, color: "var(--label-main)",
          marginTop: 4, fontWeight: 700,
        }}>
          {engineer?.name || "프로"}님
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* 오늘 번 돈 Hero 카드 — 64px / weight 700 / 반투명 0.16 박스 */}
        <div
          onClick={onClickToday}
          className="clickable"
          style={{
            background: "#FF1B8D",
            borderRadius: 22,
            padding: "24px 22px 20px",
            marginBottom: 14,
            cursor: "pointer",
            color: "#fff",
          }}
        >
          {/* 라벨 — 옅은 핑크 #FFE0EC */}
          <div style={{
            fontSize: 14, color: "#FFE0EC", fontWeight: 700,
            marginBottom: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 15 }}>💰</span> 오늘 번 돈
          </div>
          {/* Hero ₩ 64px / 700 */}
          <div style={{
            fontSize: 64, fontWeight: 700, color: "#fff",
            fontFamily: "inherit",
            letterSpacing: "-2.5px", lineHeight: 1,
            marginBottom: 10,
          }}>
            ₩{todayEarning.toLocaleString("ko-KR")}
          </div>
          {/* 헬퍼 */}
          <div style={{
            fontSize: 13, color: "#FFE0EC",
            fontWeight: 600, marginBottom: 18,
          }}>
            {completedToday.length}건 작업 완료 ·{" "}
            <span style={{ color: "#fff", fontWeight: 700 }}>자세히 보기 ›</span>
          </div>

          {/* 두 칸 박스 (반투명 0.16) */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          }}>
            <PeriodStat
              label="이번 주"
              amount={monthStats?.weekEarning || 0}
              count={monthStats?.weekCount || 0}
            />
            <PeriodStat
              label="이번 달"
              amount={monthStats?.monthEarning || 0}
              count={monthStats?.monthCount || 0}
            />
          </div>
        </div>

        {/* 회사 송금 카드 — 36px / 700 (카드 클릭 → 송금 내역) */}
        <div
          onClick={onClickPaymentHistory}
          className={onClickPaymentHistory ? "clickable" : undefined}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            cursor: onClickPaymentHistory ? "pointer" : "default",
          }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 14,
          }}>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.2px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>📥</span> 회사 송금
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: isPaymentSent ? "#03C75A" : "var(--transfer-pill-text)",
              padding: "4px 11px",
              background: isPaymentSent ? "rgba(3,199,90,0.10)" : "var(--transfer-pill-bg)",
              borderRadius: 999,
            }}>
              {isPaymentSent ? "입금 완료" : "미입금"}
            </span>
          </div>

          {/* ₩ Hero 36px / 700 */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 16,
          }}>
            <div style={{
              fontSize: 36, fontWeight: 700,
              fontFamily: "inherit",
              color: "var(--text-primary)",
              letterSpacing: "-1px", lineHeight: 1,
            }}>
              ₩{toCompanyFinal.toLocaleString("ko-KR")}
            </div>
            <div style={{
              fontSize: 13, color: "var(--label-main)", fontWeight: 700,
            }}>
              22:00 마감
            </div>
          </div>

          {/* 계좌 박스 (베이지) */}
          <div style={{
            background: "var(--account-box-bg)",
            borderRadius: 12,
            padding: "13px 15px",
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 14, gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: "var(--account-name)",
              }}>
                {account.company} · {account.bank}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: "var(--account-num)",
                fontFamily: "inherit",
                marginTop: 2,
              }}>
                {account.number}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard((account.number || "").replace(/-/g, ""), showToast, "계좌번호"); }}
              style={{
                padding: "8px 13px",
                background: "var(--copy-btn-bg)",
                border: "1px solid var(--copy-btn-bd)",
                borderRadius: 9,
                color: "var(--copy-btn-text)",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13 }}>📋</span> 복사
            </button>
          </div>

          {/* 입금 완료 보고 — 주황 풀 16/700 */}
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmPaymentSent && onConfirmPaymentSent(); }}
            disabled={isPaymentSent}
            style={{
              width: "100%", padding: 16,
              background: isPaymentSent ? "var(--bg-tertiary)" : "#FF8A3D",
              border: "none", borderRadius: 13,
              color: isPaymentSent ? "var(--text-secondary)" : "#fff",
              fontSize: 16, fontWeight: 700,
              cursor: isPaymentSent ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {isPaymentSent ? "✓ 입금 완료" : "입금 완료 보고"}
          </button>
        </div>

        {/* 유솔N 받을 돈 카드 — 26px / 700 */}
        {usolN && (
          <div
            onClick={onClickUsolN}
            className="clickable"
            style={{
              background: "var(--usol-card-bg)",
              border: "1.5px solid #03C75A",
              borderRadius: 16,
              padding: "16px 18px",
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 14,
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "#03C75A", fontWeight: 700,
                marginBottom: 7,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 19, height: 19, borderRadius: 5,
                  background: "#03C75A", color: "#fff",
                  fontSize: 11, fontWeight: 700,
                }}>N</span>
                <span>유솔N 받을 돈</span>
              </div>
              <div style={{
                fontSize: 26, fontWeight: 700,
                fontFamily: "inherit",
                color: "var(--text-primary)",
                letterSpacing: "-0.6px", lineHeight: 1,
              }}>
                {(usolN.amount || 0).toLocaleString("ko-KR")}원
              </div>
              <div style={{
                fontSize: 12, color: "var(--label-main)",
                marginTop: 5, fontWeight: 700,
              }}>
                {usolN.payDate || "—"} 입금 예정
                {usolN.count != null ? ` · ${usolN.month || new Date().getMonth() + 1}월 작업 ${usolN.count}건` : ""}
              </div>
            </div>
            <span style={{ color: "#03C75A", fontSize: 20, fontWeight: 700 }}>›</span>
          </div>
        )}

        {/* 헬퍼 박스 — 옅은 핑크 */}
        <div style={{
          padding: "13px 16px",
          background: "var(--helper-box-bg)",
          borderRadius: 12,
          fontSize: 13, color: "var(--label-main)",
          fontWeight: 600, lineHeight: 1.6,
          textAlign: "center",
        }}>
          💡 작업별 상세 정산은{" "}
          <span style={{ color: "#FF1B8D", fontWeight: 700 }}>오늘 번 돈</span>을 눌러보세요
        </div>
      </div>

      {/* V14 v6 — 토스트 (계좌 복사 등) */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 100, left: "50%",
          transform: "translateX(-50%)",
          background: toast.type === "error" ? "#FF3B5C" : "#03C75A",
          color: "#fff",
          padding: "12px 18px",
          borderRadius: 999,
          fontSize: 13, fontWeight: 700,
          zIndex: 9999,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          fontFamily: "inherit",
        }}>
          {toast.type === "error" ? "❌ " : "✓ "}{toast.message}
        </div>
      )}

      <EngineerBottomNav active="settle" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function PeriodStat({ label, amount, count }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.16)",
      borderRadius: 12,
      padding: "12px 14px",
    }}>
      <div style={{
        fontSize: 11, color: "#FFE0EC",
        fontWeight: 700, marginBottom: 5,
        letterSpacing: 0.3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 700,
        fontFamily: "inherit",
        color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.1,
      }}>
        ₩{amount.toLocaleString("ko-KR")}
      </div>
      <div style={{
        fontSize: 11, color: "#FFC8DD",
        fontWeight: 700, marginTop: 4,
      }}>
        {count}건
      </div>
    </div>
  );
}

export default EngineerSettleTab;
