// V13-FINAL — 기사 PWA 수락 대기 리스트 (가스 자동 배정 / 선착순)
// 진입: 오늘 화면 → 수락 대기 박스 클릭
// 카드: 무채색 박스 + 노랑 작업 종류 칩 inline + 정보 박스
// 수락: 흰 번개 SVG (노랑 배경) / 거절: 빨강 보더

import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";

const ICON_BOLT_WHITE = (
  <svg width="14" height="14" viewBox="0 0 24 24"
       fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

function formatMoney(n) {
  return `₩${(n || 0).toLocaleString("ko-KR")}`;
}

export function EngineerAcceptanceListScreen({
  pendingAcceptances = [],
  onBack,
  onAccept,
  onReject,
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 100 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 13,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          fontFamily: "inherit",
        }}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            🔔 수락 대기
          </div>
          <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>
            냉매충전 콜 · 선착순 · {pendingAcceptances.length}건
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {pendingAcceptances.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 12,
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
  return (
    <div style={{
      background: "var(--bg-secondary)",
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <ServiceTypeIcon workType="냉매충전" size={14} showLabel={true}/>
        <span style={{
          marginLeft: "auto", fontSize: 11,
          color: "var(--text-secondary)",
        }}>
          {call.requestedAgo || "방금"}
        </span>
      </div>

      <div style={{
        fontSize: 14, fontWeight: 700,
        color: "var(--text-primary)", marginBottom: 8,
      }}>
        {call.region || "—"}{call.appliance ? ` · ${call.appliance}` : ""}
      </div>

      <div style={{
        background: "var(--bg-tertiary)",
        borderRadius: 6,
        padding: 8,
        marginBottom: 10,
      }}>
        <Row label="📍 지역" value={call.fullAddress || call.region || "—"}/>
        <Row label="🕐 작업" value={call.workSchedule || "—"} valueColor="#FFB300" valueWeight={700}/>
        <Row label="💼 기종" value={`${call.appliance || "—"}${call.qty ? ` ×${call.qty}` : ""}`}/>
        <Row label="💰 단가" value={formatMoney(call.engineerRate)} valueColor="#FF1B8D" valueWeight={700}/>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => onAccept && onAccept(call.id)}
          style={{
            flex: 1, padding: 10,
            background: "#FFB300", border: "none",
            borderRadius: 6, color: "#fff",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 6,
          }}
        >
          {ICON_BOLT_WHITE} 수락
        </button>
        <button
          onClick={() => onReject && onReject(call.id)}
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "1px solid #FF3D5A",
            borderRadius: 6,
            color: "#FF3D5A",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          거절
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, valueWeight }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      fontSize: 10, padding: "3px 0",
    }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{
        color: valueColor || "var(--text-primary)",
        fontWeight: valueWeight || 400,
        fontFamily: label.includes("💰") ? "monospace" : "inherit",
      }}>
        {value}
      </span>
    </div>
  );
}

export default EngineerAcceptanceListScreen;
