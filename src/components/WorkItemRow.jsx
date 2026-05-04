// V14 최종 — 작업 항목 한 줄 박스 (메인 카드 통일 패턴)
// 컬러 박스 36×36 + 작업명 + 단가 (작업 종류 색 19px)
// 사용처: 메인 홈 진행중 카드 / 작업 상세 / 새 배정 상세

import { getWorkTypeColors, isDarkMode } from "../utils/workTypeColors.js";
import { useIsDark } from "../hooks/useIsDark.js";

export function WorkItemRow({ workType, appliance, qty, price, dividerTop = true }) {
  const colors = getWorkTypeColors(workType);
  const isDark = useIsDark();
  const boxBg = isDark ? colors.box.dark : colors.box.light;

  const itemName = appliance
    ? `${appliance}${qty ? ` ×${qty}` : ""}`
    : `${colors.name}${qty ? ` ×${qty}` : ""}`;

  return (
    <div style={{
      borderTop: dividerTop ? "0.5px solid var(--border)" : "none",
      paddingTop: dividerTop ? 14 : 0,
      paddingBottom: 4,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {/* 컬러 박스 36×36 */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: boxBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontSize: 18,
      }}>
        {colors.icon}
      </div>

      {/* 작업명 (가운데, 14px) */}
      <span style={{
        fontSize: 14, color: "var(--text-primary)",
        flex: 1, fontWeight: 600,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {itemName}
      </span>

      {/* 단가 (우측, 작업 종류 색 19px) */}
      {price != null && price > 0 && (
        <span style={{
          fontSize: 19, color: colors.main, fontWeight: 600,
          fontFamily: "inherit",
          letterSpacing: "-0.3px",
          flexShrink: 0,
        }}>
          ₩{price.toLocaleString("ko-KR")}
        </span>
      )}
    </div>
  );
}

export default WorkItemRow;
