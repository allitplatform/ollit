// 2026-06-24 — 올데이케어 개인정보처리방침 페이지.
//   경로: /privacy (App.jsx + main.jsx 의 _isLandingRoute 분기)
//   본문은 사장님 전달 텍스트 그대로 — 법적 문서라 임의 수정 X.
//   가독성 위주(별도 화려한 디자인 X), 모바일 readable.

import { useEffect } from "react";

const INTRO = `올데이케어(이하 "회사")는 정보주체의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 회사는 본 개인정보처리방침을 통해 수집하는 개인정보의 항목, 이용 목적, 보유 기간, 정보주체의 권리 등을 안내합니다.`;

const SECTIONS = [
  {
    title: "제1조 (수집하는 개인정보 항목)",
    body: `회사는 에어컨 서비스 출장 접수 및 상담을 위해 다음의 개인정보를 수집합니다.
- 필수 항목: 이름, 연락처, 주소

홈페이지 접수 폼을 통해 정보주체가 직접 입력한 정보가 수집되며, 전화 상담 과정에서 서비스 처리에 필요한 정보(희망 일정, 요청 사항 등)가 추가로 수집될 수 있습니다.`,
  },
  {
    title: "제2조 (개인정보의 수집 및 이용 목적)",
    body: `수집한 개인정보는 다음의 목적으로만 이용합니다.
1. 에어컨 분해세척·냉매충전·설치·수리 등 서비스의 접수 및 상담
2. 출장 일정 협의 및 서비스 제공
3. 서비스 관련 안내 및 고객 문의 응대`,
  },
  {
    title: "제3조 (개인정보의 보유 및 이용 기간)",
    body: `회사는 개인정보의 수집 및 이용 목적이 달성되면 해당 정보를 지체 없이 파기합니다. 다만 관계 법령에 따라 보존할 필요가 있는 경우 아래와 같이 보관합니다.
- 접수 후 서비스로 전환되지 않은 상담 정보: 목적 달성 또는 정보주체의 요청 시 파기
- 서비스 거래에 관한 기록: 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따라 최대 5년간 보관

보관 기간이 경과한 개인정보는 복구할 수 없는 방법으로 안전하게 파기합니다.`,
  },
  {
    title: "제4조 (개인정보의 제3자 제공)",
    body: `회사는 정보주체의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 서비스 제공을 위해 다음과 같이 개인정보를 제공합니다.
- 제공받는 자: 회사가 배정한 협력 기사
- 제공 항목: 이름, 연락처, 주소
- 제공 목적: 출장 방문 및 에어컨 서비스 수행
- 보유 기간: 서비스 제공 완료 시까지`,
  },
  {
    title: "제5조 (개인정보 처리의 위탁)",
    body: `회사는 원활한 서비스 제공을 위해 필요한 경우 개인정보 처리 업무를 외부에 위탁할 수 있으며, 위탁 시 관련 법령에 따라 수탁자가 개인정보를 안전하게 처리하도록 관리·감독합니다.`,
  },
  {
    title: "제6조 (정보주체의 권리와 행사 방법)",
    body: `정보주체는 언제든지 자신의 개인정보에 대해 다음의 권리를 행사할 수 있습니다.
1. 개인정보 열람 요구
2. 오류 정정 요구
3. 삭제 요구
4. 처리 정지 요구

권리 행사는 아래 개인정보 보호책임자에게 연락하여 요청할 수 있으며, 회사는 지체 없이 조치합니다.`,
  },
  {
    title: "제7조 (개인정보의 파기 절차 및 방법)",
    body: `회사는 보유 기간이 경과하거나 처리 목적이 달성된 개인정보를 지체 없이 파기합니다. 전자적 파일은 복구가 불가능한 방법으로 삭제하며, 출력물 등은 분쇄하거나 소각합니다.`,
  },
  {
    title: "제8조 (개인정보의 안전성 확보 조치)",
    body: `회사는 개인정보의 안전한 처리를 위해 접근 권한 관리, 접근 통제, 전송 구간 암호화 등 필요한 기술적·관리적 조치를 취합니다.`,
  },
  {
    title: "제9조 (개인정보 보호책임자)",
    body: `회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 정보주체의 문의·불만을 처리하기 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
- 개인정보 보호책임자: 조동욱, 구현서
- 연락처: 1866-2003`,
  },
  {
    title: "제10조 (사업자 정보)",
    body: `- 상호: 올데이케어
- 사업자등록번호: 430-07-03167
- 주소: 경기도 고양시 덕양구
- 대표 연락처: 1866-2003`,
  },
  {
    title: "제11조 (개인정보처리방침의 변경)",
    body: `본 개인정보처리방침은 법령 또는 서비스 내용의 변경에 따라 개정될 수 있으며, 변경 시 홈페이지를 통해 공지합니다.`,
  },
];

const EFFECTIVE_DATE = "시행일: 2026년 6월 24일";

export default function PrivacyPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "개인정보처리방침 - 올데이케어";
    return () => { document.title = prev; };
  }, []);

  function goBack() {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      color: "#1C2B3A",
      fontFamily: "'Noto Sans KR', sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "#fff",
        borderBottom: "1px solid #E5EAF1",
        padding: "12px 18px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={goBack} aria-label="뒤로" style={{
          background: "transparent", border: "none",
          cursor: "pointer", fontSize: 22, color: "#1C2B3A",
          padding: 4, lineHeight: 1,
        }}>←</button>
        <h1 style={{
          fontSize: 17, fontWeight: 800, color: "#1C2B3A",
          letterSpacing: "-0.3px",
        }}>개인정보처리방침</h1>
      </header>

      {/* Body */}
      <main style={{
        maxWidth: 780, margin: "0 auto",
        padding: "32px 22px 80px",
      }}>
        <h2 style={{
          fontSize: 24, fontWeight: 900,
          letterSpacing: "-0.5px",
          marginBottom: 18,
          color: "#1C2B3A",
        }}>올데이케어 개인정보처리방침</h2>

        <p style={{
          fontSize: 15, color: "#3A4E62",
          lineHeight: 1.85, letterSpacing: "-0.2px",
          marginBottom: 8,
        }}>{INTRO}</p>

        {SECTIONS.map((sec, i) => (
          <section key={i} style={{ marginTop: 32 }}>
            <h3 style={{
              fontSize: 16, fontWeight: 800,
              color: "#1C2B3A",
              letterSpacing: "-0.3px",
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: "1px solid #EEF2F7",
            }}>{sec.title}</h3>
            <div style={{
              fontSize: 14.5, color: "#3A4E62",
              lineHeight: 1.85, letterSpacing: "-0.2px",
              whiteSpace: "pre-line",
            }}>{sec.body}</div>
          </section>
        ))}

        <p style={{
          marginTop: 40,
          fontSize: 13, color: "#6A7D94",
          letterSpacing: "-0.2px",
          textAlign: "right",
        }}>{EFFECTIVE_DATE}</p>
      </main>
    </div>
  );
}
