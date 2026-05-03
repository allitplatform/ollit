import { OllitMark } from "./OllitMark.jsx";

// 로딩 인디케이터 — OllitMark 펄스 재사용
// 사용: <OllitLoader/> 또는 <OllitLoader size={32} label="불러오는 중..."/>
export function OllitLoader({ size = 32, label, color }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 24,
    }}>
      <OllitMark size={size} color={color}/>
      {label && (
        <div style={{ fontSize: 11, color: "#888780", letterSpacing: 0.3 }}>{label}</div>
      )}
    </div>
  );
}

export default OllitLoader;
