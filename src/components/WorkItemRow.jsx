// V14 v6 — 작업 항목 한 줄 박스 (사장님 spec 정확)
// 컬러 박스 36×36 + 작업 종류 (작은/컬러) + 기종 ×수량 (큰/검정) + 단가 우측
// 사용처: 메인 홈 진행중 카드 / 작업 상세 / 새 배정 상세

import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { useIsDark } from "../hooks/useIsDark.js";

function isUsolNCleaning(client, workType) {
  return client === "유솔홈케어 N" && (workType || "").includes("세척");
}

export function WorkItemRow({ workType, appliance, qty, price, client, dividerTop = true, isCanceled = false, priceLabel = null }) {
  const colors = getWorkTypeColors(workType);
  const isDark = useIsDark();
  const boxBg = isDark ? colors.box.dark : colors.box.light;
  const isUsolN = isUsolNCleaning(client, workType);

  return (
    <div style={{
      borderTop: dividerTop ? "0.5px solid var(--border)" : "none",
      paddingTop: dividerTop ? 14 : 0,
      paddingBottom: 4,
      display: "flex", alignItems: "center", gap: 10,
      opacity: isCanceled ? 0.55 : 1,
    }}>
      {/* 컬러 박스 36×36 */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: boxBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontSize: 18,
        filter: isCanceled ? "grayscale(1)" : "none",
      }}>
        {colors.icon}
      </div>

      {/* 가운데: 종류 (작은/컬러) + 기종 ×수량 (큰/검정) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isCanceled ? "#9CA3AF" : colors.main,
          marginBottom: 2,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{colors.name}</span>
          {isUsolN && !isCanceled && (
            <span style={{
              background: "#03C75A", color: "#fff",
              fontSize: 9, padding: "2px 5px",
              borderRadius: 4, fontWeight: 800,
            }}>N</span>
          )}
          {isCanceled && (
            <span style={{
              background: "rgba(156, 163, 175, 0.18)", color: "#9CA3AF",
              fontSize: 9, padding: "2px 6px",
              borderRadius: 4, fontWeight: 800,
            }}>✗ 취소</span>
          )}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isCanceled ? "#9CA3AF" : "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecoration: isCanceled ? "line-through" : "none",
        }}>
          {appliance || workType || colors.name}{qty ? ` ×${qty}` : ""}
        </div>
      </div>

      {/* 단가 (우측, 컬러 17/800) — 취소 시 ₩0 회색
          2026-05-27: priceLabel 옵션 — 있으면 금액 위에 마이크로 라벨 (usol_n "내 정산금" 등) */}
      {isCanceled ? (
        <span style={{
          fontSize: 17, color: "#9CA3AF", fontWeight: 800,
          fontFamily: "inherit",
          letterSpacing: "-0.3px",
          flexShrink: 0,
        }}>
          ₩0
        </span>
      ) : (price != null && price > 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          flexShrink: 0, lineHeight: 1.1,
        }}>
          {priceLabel && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: 2,
              letterSpacing: 0.2,
            }}>{priceLabel}</span>
          )}
          <span style={{
            fontSize: 17, color: colors.main, fontWeight: 800,
            fontFamily: "inherit",
            letterSpacing: "-0.3px",
          }}>
            ₩{price.toLocaleString("ko-KR")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default WorkItemRow;
