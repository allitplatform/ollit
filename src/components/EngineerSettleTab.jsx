// V13-FINAL2-fix1 — 정산 탭 (catch #1 핫핑크 포인트 + #2 폰트 키우기)
// 회사 정산 영역 = 좌측 핫핑크 보더 / 송금 금액 핫핑크 / 입금 완료 보고 단색 핫핑크

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
  onClickUsolN,
  onConfirmPaymentSent,
  onTabChange,
  unreadCount = 0,
}) {
  const todayEarning = todayTasks.reduce((s, t) => s + getEarning(t), 0);
  const totalRevenue = todayTasks.reduce((s, t) => s + getRevenue(t), 0);
  const toCompany = Math.max(0, totalRevenue - todayEarning);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>💰 정산</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {engineer?.name || "기사"}님
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* V13-FINAL2-fix2 — 패딩 18 / 금액 38px */}
        <div style={{
          background: "#FF1B8D",
          borderRadius: 12,
          padding: 18,
          marginBottom: 12,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
            오늘 번 돈
          </div>
          <div style={{
            fontSize: 38, fontWeight: 700, color: "#fff",
            fontFamily: "monospace", letterSpacing: "-1px", lineHeight: 1,
          }}>
            ₩{todayEarning.toLocaleString("ko-KR")}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
            {todayTasks.length}건 작업 완료
          </div>
        </div>

        {/* 2. 이번 주 / 이번 달 */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
          marginBottom: 14,
        }}>
          <StatBox
            label="이번 주"
            amount={monthStats?.weekEarning || 0}
            count={monthStats?.weekCount || 0}
            period="이번 주"
          />
          <StatBox
            label="이번 달"
            amount={monthStats?.monthEarning || 0}
            count={monthStats?.monthCount || 0}
            period={`${monthStats?.month || new Date().getMonth() + 1}월`}
          />
        </div>

        {/* 3. 오늘 작업 리스트 */}
        {todayTasks.length > 0 && (
          <div style={{
            background: "var(--bg-secondary)",
            borderRadius: 10, padding: 12, marginBottom: 14,
          }}>
            <div style={{
              fontSize: 12, color: "var(--text-secondary)",
              fontWeight: 700, marginBottom: 8,
            }}>
              📋 오늘 작업
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {todayTasks.map((t, i) => (
                <div key={t.id} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: i < todayTasks.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {t.customer} · {t.appliance}{t.qty ? ` ×${t.qty}` : ""}
                    </div>
                    <div style={{
                      fontSize: 11, color: "var(--text-secondary)", marginTop: 1,
                    }}>
                      {t.scheduledTime || t.time || "—"}{t.region ? ` · ${t.region}` : ""}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                  }}>
                    ₩{getEarning(t).toLocaleString("ko-KR")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. 회사 정산 (catch #1 핫핑크 포인트) */}
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 12,
          borderLeft: "3px solid #FF1B8D",
          marginBottom: 14,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 8,
          }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>
                회사 정산 (오늘 22시까지)
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                총 매출에서 내 수익 제외
              </div>
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, fontFamily: "monospace",
              color: "#FF1B8D",
            }}>
              ₩{toCompany.toLocaleString("ko-KR")}
            </div>
          </div>

          <div style={{
            background: "var(--bg-primary)",
            borderRadius: 6, padding: 8, marginBottom: 8,
          }}>
            <Row label="총 매출" value={`₩${totalRevenue.toLocaleString("ko-KR")}`}/>
            <Row label="내 수익" value={`- ₩${todayEarning.toLocaleString("ko-KR")}`}/>
            <div style={{
              borderTop: "1px solid var(--border)",
              marginTop: 4, paddingTop: 4,
              display: "flex", justifyContent: "space-between",
              fontWeight: 700,
            }}>
              <span style={{ fontSize: 12 }}>회사 송금</span>
              <span style={{
                fontSize: 13, fontFamily: "monospace",
                color: "#FF1B8D", fontWeight: 700,
              }}>
                ₩{toCompany.toLocaleString("ko-KR")}
              </span>
            </div>
          </div>

          <div style={{
            background: "var(--bg-primary)",
            borderRadius: 6, padding: 8, marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>🏦 회사 계좌</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                국민 123-456-789012
              </div>
            </div>
            <button
              onClick={() => copyToClipboard("123456789012")}
              style={{
                padding: "4px 10px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text-primary)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              복사
            </button>
          </div>

          {/* catch #1 — 입금 완료 보고 = 단색 핫핑크 */}
          <button
            onClick={onConfirmPaymentSent}
            style={{
              width: "100%", padding: 12,
              background: "#FF1B8D",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ✓ 입금 완료 보고
          </button>
        </div>

        {/* 5. 유솔N 누계 */}
        {usolN && (
          <div
            onClick={onClickUsolN}
            style={{
              background: "rgba(0,135,90,0.06)",
              border: "1px solid rgba(0,135,90,0.25)",
              borderRadius: 10, padding: 12, cursor: "pointer",
            }}
          >
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "#00875A", fontWeight: 700 }}>
                  🟢 유솔N · {usolN.month}월 누계
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {usolN.payDate} 입금 예정
                </div>
              </div>
              <span style={{
                fontSize: 17, fontWeight: 700,
                color: "#00875A", fontFamily: "monospace",
              }}>
                ₩{(usolN.amount || 0).toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        )}
      </div>

      <EngineerBottomNav active="settle" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function StatBox({ label, amount, count, period }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      borderRadius: 8, padding: 10,
    }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>
        ₩{amount.toLocaleString("ko-KR")}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
        {count}건 · {period}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

export default EngineerSettleTab;
