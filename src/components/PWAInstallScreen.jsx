// 풀스크린 PWA 홈 추가 안내
// 모달 X / 페이지 자체가 안내 ⭐
// 50대 사용자 기준 글자 크기 박음 (모든 텍스트 ≥ 14px / 핵심 ≥ 16px / 버튼 ≥ 17px)

import { OllitMark } from "./OllitMark.jsx";

export function PWAInstallScreen({ platform, onAdd, onLater }) {
  const isInApp = platform === "inApp";
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 본문 (스크롤 가능) */}
      <div style={{
        flex: 1,
        padding: "40px 24px 24px",
        textAlign: "center",
        overflowY: "auto",
      }}>
        {/* 로고 — 검정 라운드 박스 + OllitMark (로그인 화면과 동일) */}
        <div style={{
          width: 120, height: 120,
          background: "#1A1A1A",
          borderRadius: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
          boxShadow: "0 8px 24px rgba(255,27,141,0.15)",
        }}>
          <OllitMark size={84}/>
        </div>

        {/* 타이틀 */}
        <div style={{
          fontSize: 24, fontWeight: 800,
          marginBottom: 8,
          letterSpacing: -0.5,
        }}>
          올잇
        </div>
        <div style={{
          fontSize: 17,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          marginBottom: 28,
          maxWidth: 320,
          marginLeft: "auto",
          marginRight: "auto",
        }}>
          {isInApp
            ? <>외부 브라우저로 열어주세요<br/>홈 화면에 추가하려면 Safari/Chrome이 필요해요</>
            : <>홈 화면에 추가하면<br/>앱처럼 빠르게 사용할 수 있어요</>}
        </div>

        {/* 인앱 브라우저는 혜택 그리드 X — 외부 브라우저로 열기 안내만 */}
        {!isInApp && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            maxWidth: 360,
            margin: "0 auto 24px",
          }}>
            <Benefit icon="⚡" title="앱처럼 빠르게" desc="브라우저 탭 X"/>
            <Benefit icon="🔔" title="푸시 알림" desc="새 배정 즉시"/>
            <Benefit icon="📡" title="오프라인" desc="신호 없어도"/>
            <Benefit icon="📷" title="카메라 GPS" desc="현장 사진 즉시"/>
          </div>
        )}

        {/* 추가 방법 */}
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 18,
          textAlign: "left",
          maxWidth: 360,
          margin: "0 auto",
        }}>
          {isInApp && (
            <>
              <PlatformLabel>📲 인앱 브라우저 안내</PlatformLabel>
              <Step num="1" text={<>화면 <Bold>우측 상단 ⋮</Bold>(또는 ···) 누르기</>}/>
              <Step num="2" text={<>"<Bold style={{ color: "#FF1B8D" }}>외부 브라우저로 열기</Bold>" 또는<br/>"<Bold style={{ color: "#FF1B8D" }}>Safari로 열기</Bold>" 누르기</>}/>
              <Step num="3" text={<>외부 브라우저에서 홈 화면 추가</>}/>
            </>
          )}
          {platform === "ios" && (
            <>
              <PlatformLabel>아이폰 (Safari)</PlatformLabel>
              <Step num="1" text={<>하단 공유 버튼 <Glyph>⎙</Glyph> 누르기</>}/>
              <Step num="2" text={<>"<Bold>홈 화면에 추가</Bold>" 선택</>}/>
              <Step num="3" text={<>"<Bold>추가</Bold>" 누르기</>}/>
            </>
          )}
          {platform === "android" && (
            <>
              <PlatformLabel>안드로이드 (Chrome)</PlatformLabel>
              <Step num="1" text={<>아래 "<Bold>추가하기</Bold>" 누르면 자동 설치</>}/>
              <Step num="2" text={<>홈 화면에서 올잇 클릭</>}/>
            </>
          )}
          {(platform === "other" || platform === "unknown") && (
            <>
              <PlatformLabel>데스크탑 / 기타</PlatformLabel>
              <div style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}>
                브라우저 메뉴에서 "<Bold>앱 설치</Bold>" 또는<br/>
                "<Bold>바탕화면에 바로가기 만들기</Bold>"를 선택하세요.
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 고정 액션 */}
      <div style={{
        padding: "14px 16px 22px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-primary)",
        display: "flex", gap: 8,
      }}>
        <button onClick={onLater} style={{
          flex: 1, padding: 18,
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text-secondary)",
          fontSize: 17, fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}>
          나중에
        </button>
        <button onClick={onAdd} style={{
          flex: 2, padding: 18,
          background: "#FF1B8D",
          border: "none",
          borderRadius: 10,
          color: "#fff",
          fontSize: 17, fontWeight: 800,
          cursor: "pointer",
          fontFamily: "inherit",
        }}>
          추가하기
        </button>
      </div>
    </div>
  );
}

function Benefit({ icon, title, desc }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px 10px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

function PlatformLabel({ children }) {
  return (
    <div style={{
      fontSize: 14, fontWeight: 800,
      color: "var(--text-secondary)",
      letterSpacing: 0.3,
      textTransform: "uppercase",
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Step({ num, text }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
    }}>
      <span style={{
        width: 28, height: 28,
        borderRadius: "50%",
        background: "#FF1B8D",
        color: "#fff",
        fontSize: 14, fontWeight: 800,
        display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {num}
      </span>
      <span style={{ fontSize: 16, color: "var(--text-primary)", lineHeight: 1.6 }}>
        {text}
      </span>
    </div>
  );
}

function Bold({ children }) {
  return <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{children}</span>;
}

function Glyph({ children }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 4,
      background: "var(--bg-primary)",
      border: "1px solid var(--border)",
      fontSize: 14,
    }}>{children}</span>
  );
}

export default PWAInstallScreen;
