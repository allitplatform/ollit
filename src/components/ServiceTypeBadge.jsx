// V11-9 — 작업 종류 배지 (세척❄️ / 냉매⚡ / 출장🚗 / 추가➕)
// 사용처: 작업 카드 / 통계 / 어디든
import { detectServiceType } from "../data/serviceTypes.js";

const SIZE_MAP = {
  sm: { padding: "2px 6px",  fontSize: 9,  iconSize: 10 },
  md: { padding: "3px 8px",  fontSize: 11, iconSize: 12 },
  lg: { padding: "4px 10px", fontSize: 13, iconSize: 14 },
};

export function ServiceTypeBadge({ task, size = "md", showLabel = true, type: typeOverride }) {
  const type = typeOverride || detectServiceType(task);
  const sz   = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: sz.padding,
      background: type.bgColor,
      border: `1px solid ${type.borderColor}`,
      borderRadius: 4,
      color: type.textColor,
      fontSize: sz.fontSize, fontWeight: 600,
      whiteSpace: "nowrap", lineHeight: 1.2,
    }}>
      <span style={{ fontSize: sz.iconSize }}>{type.icon}</span>
      {showLabel && <span>{type.label}</span>}
    </span>
  );
}

// 아이콘만 (이름 없는 컴팩트 버전)
export function ServiceTypeIcon({ task, size = 14 }) {
  const type = detectServiceType(task);
  return (
    <span style={{ fontSize: size }} title={type.label}>
      {type.icon}
    </span>
  );
}

export default ServiceTypeBadge;
