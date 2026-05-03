// src/components/PWAInstallModal.jsx
// 홈 화면 추가 안내 - iOS / Android 분기

export function PWAInstallModal({ open, platform, onAdd, onLater }) {
  if (!open) return null;

  return (
    <div onClick={onLater} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.6)",
      zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 320,
        background: "var(--bg-secondary)",
        borderRadius: 14,
        padding: "24px 20px",
        textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: 14,
          background: "#FF1B8D",
          display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          marginBottom: 14,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>

        <div style={{
          fontSize: 16, fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 6,
        }}>
          홈 화면에 올잇 추가
        </div>

        <div style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginBottom: 18,
          lineHeight: 1.5,
        }}>
          한 번 추가하면<br/>일반 앱처럼 빠르게 열어요
        </div>

        {platform === "ios" && (
          <div style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            textAlign: "left",
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              fontWeight: 700,
              marginBottom: 8,
            }}>
              아이폰 (Safari)
            </div>
            <StepRow num="1" text="하단 공유 버튼 ⎙ 누르기"/>
            <StepRow num="2" text='"홈 화면에 추가" 선택'/>
            <StepRow num="3" text='"추가" 누르기'/>
          </div>
        )}

        {platform === "android" && (
          <div style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            textAlign: "left",
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              fontWeight: 700,
              marginBottom: 8,
            }}>
              안드로이드 (Chrome)
            </div>
            <StepRow num="1" text='"추가하기" 누르면 자동 설치'/>
            <StepRow num="2" text="홈 화면에서 올잇 클릭"/>
          </div>
        )}

        {platform === "other" && (
          <div style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            textAlign: "left",
            marginBottom: 14,
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}>
            브라우저 메뉴에서 "앱 설치" 또는<br/>
            "바탕화면에 바로가기 만들기"를 선택해주세요.
          </div>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onLater} style={{
            flex: 1, padding: 12,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
            나중에
          </button>
          <button onClick={onAdd} style={{
            flex: 1, padding: 12,
            background: "#FF1B8D",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
            추가하기
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ num, text }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    }}>
      <span style={{
        width: 18, height: 18,
        borderRadius: "50%",
        background: "#FF1B8D",
        color: "#fff",
        fontSize: 10, fontWeight: 700,
        display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {num}
      </span>
      <span style={{
        fontSize: 11,
        color: "var(--text-primary)",
      }}>
        {text}
      </span>
    </div>
  );
}
