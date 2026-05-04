// V14 정제 — 수락 대기 화면 (전체 노랑 톤)
// 흰 카드 + 좌측 4px 노랑 바 / 헤더 박스 + 텍스트 그룹 / 정보 + 단가 / 수락(노랑) + 거절(보더)

import { ArrowLeft } from "lucide-react";

export function EngineerAcceptanceListScreen({
  pendingAcceptances = [],
  onBack,
  onAccept,
  onReject,
}) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 100,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", padding: 4,
          cursor: "pointer", display: "flex", alignItems: "center",
          fontFamily: "inherit",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            🔔 수락 대기
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
            냉매충전 콜 · 선착순 · {pendingAcceptances.length}건
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {pendingAcceptances.length === 0 ? (
          <div style={{
            padding: 30, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 14,
          }}>
            수락 대기 콜 없음
          </div>
        ) : (
          pendingAcceptances.map(call => (
            <AcceptanceCard
              key={call.id}
              call={call}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AcceptanceCard({ call, onAccept, onReject }) {
  const fee = call.engineerRate || 0;
  // 작업 종류 라벨 — 냉매충전 → 냉매
  const workTypeShort = call.workType === "냉매충전" ? "냉매" : (call.workType || "");
  // 일정 라벨 (call.workSchedule = "당일 (오후)" → "당일 오후")
  const scheduleStr = (call.workSchedule || "").replace(/[()]/g, "").trim();

  return (
    <div style={{
      position: "relative",
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "14px 14px 14px 18px",
      marginBottom: 10,
      overflow: "hidden",
    }}>
      {/* 좌측 4px 노랑 바 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: "#FFB800",
      }}/>

      {/* 헤더 행 — 노랑 박스 + 텍스트 그룹 */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center",
        marginBottom: 14,
      }}>
        {/* 컬러 박스 40×40 */}
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: "#FFE699",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          fontSize: 20,
        }}>
          ⚡
        </div>

        {/* 텍스트 그룹 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 1행: 냉매 · 당일 오후 + 5분 전 */}
          <div style={{
            display: "flex", alignItems: "baseline",
            gap: 4, marginBottom: 4,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: "var(--text-primary)",
            }}>
              {workTypeShort}
            </span>
            {scheduleStr && (
              <>
                <span style={{ fontSize: 13, color: "#888" }}>·</span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: "var(--refrig-text)",
                }}>
                  {scheduleStr}
                </span>
              </>
            )}
            <span style={{
              marginLeft: "auto",
              fontSize: 11, color: "#888", fontWeight: 600,
              flexShrink: 0,
            }}>
              {call.requestedAgo || "방금"}
            </span>
          </div>

          {/* 2행: 강남구 · 시스템 멀티 */}
          <div style={{
            fontSize: 16, fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {call.region || "—"}{call.appliance ? ` · ${call.appliance}` : ""}
          </div>
        </div>
      </div>

      {/* 정보 + 단가 행 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-end", marginBottom: 14, gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontWeight: 600, marginBottom: 4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            📍 {call.fullAddress || call.region || "—"}
          </div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            💼 {call.appliance || "—"}{call.qty ? ` ×${call.qty}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize: 10, color: "#888", fontWeight: 600,
            marginBottom: 2,
          }}>
            단가
          </div>
          <div style={{
            fontSize: 22, fontWeight: 600,
            color: "#FFB800",
            fontFamily: "inherit",
            letterSpacing: "-0.3px",
          }}>
            ₩{fee.toLocaleString("ko-KR")}
          </div>
        </div>
      </div>

      {/* 액션 — 수락(노랑) + 거절(보더) */}
      <div style={{
        display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6,
      }}>
        <button
          onClick={() => onAccept && onAccept(call.id)}
          style={{
            padding: 11,
            background: "#FFB800",
            border: "none",
            borderRadius: 9,
            color: "#1A1A1A",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          수락
        </button>
        <button
          onClick={() => onReject && onReject(call.id)}
          style={{
            padding: 11,
            background: "transparent",
            border: "1.5px solid var(--input-border)",
            borderRadius: 9,
            color: "#888",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          거절
        </button>
      </div>
    </div>
  );
}

export default EngineerAcceptanceListScreen;
