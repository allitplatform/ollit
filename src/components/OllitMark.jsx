// 올잇 마크 — 두 원 외접 + 가운데 펄스 (살아있는 호흡)
// 외접 검증: cx1 + r = cx2 - r = size/2
// 사용: <OllitMark/> 또는 <OllitMark size={88} color="#FF1B8D"/>
export function OllitMark({ size = 20, color = "#FF1B8D" }) {
  const r   = size * 0.23;
  const cx1 = size * 0.27;
  const cx2 = size * 0.73;
  // cx1 + r = 0.27 + 0.23 = 0.50 = size/2 (외접 ✓)
  // cx2 - r = 0.73 - 0.23 = 0.50 = size/2 (외접 ✓)

  const dot    = size * 0.10;
  const dotMin = dot * 0.7;
  const dotMax = dot * 1.4;

  const stroke = size > 60 ? 4 : 1.5;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="올잇">
      <circle cx={cx1} cy={size / 2} r={r}
              fill="none" stroke={color} strokeWidth={stroke}/>
      <circle cx={cx2} cy={size / 2} r={r}
              fill="none" stroke={color} strokeWidth={stroke}/>
      <circle cx={size / 2} cy={size / 2} r={dot} fill={color}>
        <animate attributeName="r"
                 values={`${dotMin};${dotMax};${dotMin}`}
                 dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity"
                 values="0.5;1;0.5"
                 dur="1.8s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

export default OllitMark;
