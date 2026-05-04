// V14 — 정산 메인 (깔끔 버전)
// 오늘 번 돈 / 이번 주 / 이번 달 = 한 카드 통합
// 회사 송금 = 간단 박스 / 유솔N 그린 / 안내 문구
// 작업별 상세는 오늘 번 돈 카드 클릭 → 정산 상세 페이지

import { EngineerBottomNav } from "./EngineerBottomNav.jsx";

function getEarning(t) {
  return t.engineerEarning || t.engineerNet || 0;
}

function getRevenue(t) {
  return (t.estimateTotal || 0) + (t.addonFee || 0) + (t.extraFee || 0);
}

function copyToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export function EngineerSettleTab({
  engineer,
  todayTasks = [],
  monthStats,
  usolN,
  companyAccount,
  toCompany,
  isPaymentSent = false,
  onClickToday,
  onClickUsolN,
  onConfirmPaymentSent,
  onTabChange,
  unreadCount = 0,
}) {
  const completedToday = todayTasks.filter(t => t.status === "완료");
  const todayEarning  = completedToday.reduce((s, t) => s + getEarning(t), 0);
  const todayRevenue  = completedToday.reduce((s, t) => s + getRevenue(t), 0);
  const toCompanyFinal = toCompany != null ? toCompany : Math.max(0, todayRevenue - todayEarning);

  const account = companyAccount || {
    company: "올데이케어",
    bank: "우리은행",
    number: "1002-XXX-XXXXXX",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
      fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>💰 정산</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
          {engineer?.name || "기사"}님
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* 1. 오늘 번 돈 통합 카드 (핑크 단색 / 클릭 가능) */}
        <div
          onClick={onClickToday}
          className="clickable"
          style={{
            background: "#FF1B8D",
            borderRadius: 14,
            padding: 22,
            marginBottom: 14,
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <div style={{
            fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 600,
            marginBottom: 8,
          }}>
            💰 오늘 번 돈
          </div>
          <div style={{
            fontSize: 56, fontWeight: 900, color: "#fff",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-2px", lineHeight: 1,
          }}>
            ₩{todayEarning.toLocaleString("ko-KR")}
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.9)",
            marginTop: 10, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>{completedToday.length}건 작업 완료</span>
            <span>·</span>
            <span style={{ fontWeight: 700 }}>자세히 보기 ›</span>
          </div>

          {/* 구분선 */}
          <div style={{
            height: 1,
            background: "rgba(255,255,255,0.20)",
            margin: "16px 0 14px",
          }}/>

          {/* 이번 주 / 이번 달 */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
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

        {/* 2. 회사 송금 박스 (간단) */}
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 14,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>📤</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>회사 송금</span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: isPaymentSent ? "#03C75A" : "#FF3B5C",
              padding: "3px 8px",
              background: isPaymentSent ? "rgba(3,199,90,0.10)" : "rgba(255,59,92,0.10)",
              borderRadius: 6,
            }}>
              {isPaymentSent ? "입금 완료" : "미입금"}
            </span>
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 14,
          }}>
            <div style={{
              fontSize: 24, fontWeight: 900,
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
            }}>
              ₩{toCompanyFinal.toLocaleString("ko-KR")}
            </div>
            <div style={{
              fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
            }}>
              22:00 마감
            </div>
          </div>

          {/* 구분선 */}
          <div style={{
            height: 1, background: "var(--border)", marginBottom: 12,
          }}/>

          {/* 계좌 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, color: "var(--text-secondary)", fontWeight: 600,
                marginBottom: 2,
              }}>
                {account.company} · {account.bank}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: "var(--text-primary)",
              }}>
                {account.number}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard((account.number || "").replace(/-/g, ""))}
              style={{
                padding: "8px 12px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              📋 복사
            </button>
          </div>

          {/* 입금 완료 보고 (주황 풀폭) */}
          <button
            onClick={onConfirmPaymentSent}
            disabled={isPaymentSent}
            style={{
              width: "100%", padding: 14,
              background: isPaymentSent ? "var(--bg-tertiary)" : "#FF8A3D",
              border: "none",
              borderRadius: 10,
              color: isPaymentSent ? "var(--text-secondary)" : "#fff",
              fontSize: 15, fontWeight: 800,
              cursor: isPaymentSent ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {isPaymentSent ? "✓ 입금 완료" : "입금 완료 보고"}
          </button>
        </div>

        {/* 3. 유솔N 박스 (그린) */}
        {usolN && (
          <div
            onClick={onClickUsolN}
            className="clickable"
            style={{
              background: "rgba(3,199,90,0.08)",
              border: "1px solid rgba(3,199,90,0.30)",
              borderRadius: 12, padding: 16,
              marginBottom: 14,
              cursor: "pointer",
            }}
          >
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 6,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "#03C75A", fontWeight: 800,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, height: 18, borderRadius: 4,
                  background: "#03C75A", color: "#fff",
                  fontSize: 11, fontWeight: 900,
                }}>N</span>
                <span>유솔N — 받을 돈</span>
              </div>
              <span style={{ fontSize: 16, color: "#03C75A" }}>›</span>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
              marginBottom: 6,
            }}>
              {(usolN.amount || 0).toLocaleString("ko-KR")}원
            </div>
            <div style={{
              fontSize: 12, color: "var(--text-secondary)", fontWeight: 500,
            }}>
              {usolN.payDate || "—"} 입금 예정
              {usolN.count != null ? ` · ${usolN.month || new Date().getMonth() + 1}월 작업 ${usolN.count}건` : ""}
            </div>
          </div>
        )}

        {/* 4. 안내 문구 */}
        <div style={{
          padding: "12px 14px",
          background: "var(--accent-bg)",
          borderRadius: 10,
          fontSize: 12, color: "var(--text-secondary)",
          fontWeight: 500, lineHeight: 1.5,
          textAlign: "center",
        }}>
          💡 작업별 상세 정산 내역은<br/>
          <span style={{ color: "#FF1B8D", fontWeight: 700 }}>오늘 번 돈</span>을 눌러보세요
        </div>
      </div>

      <EngineerBottomNav active="settle" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function PeriodStat({ label, amount, count }) {
  return (
    <div>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.85)",
        fontWeight: 600, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 800,
        fontFamily: "'JetBrains Mono', monospace",
        color: "#fff", letterSpacing: "-0.3px",
      }}>
        ₩{amount.toLocaleString("ko-KR")}
      </div>
      <div style={{
        fontSize: 11, color: "rgba(255,255,255,0.85)",
        fontWeight: 500, marginTop: 2,
      }}>
        {count}건
      </div>
    </div>
  );
}

export default EngineerSettleTab;
