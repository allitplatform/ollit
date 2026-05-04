// V13-FINAL2-fix1 catch #6-1 — 알림 설정 화면
// 종류별 ON/OFF + 푸시 / 사운드 / 진동

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

const SETTINGS = [
  { id: "new_assign",  label: "새 배정",        desc: "고객 통화 필요" },
  { id: "reschedule",  label: "일정 변경",      desc: "운영팀 일정 변경" },
  { id: "payment_ok",  label: "입금 확인",      desc: "회사 송금 처리" },
  { id: "settle_due",  label: "정산 마감 임박", desc: "오늘 22시 알림" },
  { id: "ops_memo",    label: "운영팀 메모",    desc: "작업 안내" },
  { id: "cancel",      label: "작업 취소",      desc: "고객 / 운영팀 취소" },
];

const GLOBAL = [
  { id: "push",    label: "푸시 알림", desc: "전체 ON/OFF" },
  { id: "sound",   label: "사운드",    desc: "" },
  { id: "vibrate", label: "진동",      desc: "" },
];

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  padding: "4px 10px",
  display: "flex", alignItems: "center", gap: 4,
};

export function EngineerNotiSettingsScreen({ onBack }) {
  const [settings, setSettings] = useState(() => {
    const init = {};
    [...SETTINGS, ...GLOBAL].forEach(s => { init[s.id] = true; });
    return init;
  });

  function toggle(id) {
    setSettings(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700 }}>
          🔔 알림 설정
        </div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: "16px" }}>
        <SectionTitle title="알림 종류"/>
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 4, marginBottom: 16,
        }}>
          {SETTINGS.map((s, i) => (
            <Row
              key={s.id}
              label={s.label}
              desc={s.desc}
              on={settings[s.id]}
              onToggle={() => toggle(s.id)}
              divider={i < SETTINGS.length - 1}
            />
          ))}
        </div>

        <SectionTitle title="전체"/>
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: 10, padding: 4,
        }}>
          {GLOBAL.map((s, i) => (
            <Row
              key={s.id}
              label={s.label}
              desc={s.desc}
              on={settings[s.id]}
              onToggle={() => toggle(s.id)}
              divider={i < GLOBAL.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div style={{
      fontSize: 13, color: "var(--text-secondary)",
      fontWeight: 700, marginBottom: 8, marginLeft: 4,
    }}>
      {title}
    </div>
  );
}

function Row({ label, desc, on, onToggle, divider }) {
  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", padding: 12,
          cursor: "pointer",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
          {desc && (
            <div style={{
              fontSize: 11, color: "var(--text-secondary)", marginTop: 2,
            }}>
              {desc}
            </div>
          )}
        </div>
        <ToggleSwitch on={on}/>
      </div>
      {divider && <div style={{
        height: 1, background: "var(--border)", margin: "0 12px",
      }}/>}
    </>
  );
}

function ToggleSwitch({ on }) {
  return (
    <div style={{
      width: 36, height: 20, borderRadius: 10,
      background: on ? "#FF1B8D" : "var(--border)",
      position: "relative",
      transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 2,
        left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
      }}/>
    </div>
  );
}

export default EngineerNotiSettingsScreen;
