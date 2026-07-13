// 올데이케어 마케팅 랜딩 v5 — 1:1 정답 복제 (2026-06-23).
//   · 정답 source: design_handoff_alldaycare_landing/올데이케어 랜딩.dc.html
//     + 정답_올데이케어 랜딩 (standalone).html.
//   · 0_먼저읽기_똑같이_복제하는법.md 규칙 그대로: 문구/폰트/색상/간격/애니메이션
//     하나도 바꾸지 X — 프레임워크만 우리 React/Vite 로 옮김.
//   · 단 사장님 별 spec: 가격표 sale 금액 '~' 표기 (확정가 오해 방지).

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import PrivacyPage from "./PrivacyPage.jsx";
import "../styles/landing.css";

const PHONE_DISPLAY = "1866-2003";
const PHONE_TEL     = "tel:18662003";

// service_type 한글 라벨 → RPC 코드. 폼 option value 와 키 정확 일치 (사장님 약점 #2).
const SERVICE_CODE = {
  '냉매충전':       'refrigerant',
  '분해세척':       'cleaning',
  '수리·누설수리':  'repair',
  '에어컨 설치':    'install',
  '잘 모르겠어요':  'unknown',
};

// RPC 영문 RAISE EXCEPTION 코드 → 손님 안내 한글
function messageFor(e) {
  const m = String(e?.message || '');
  if (m.includes('privacy_not_agreed'))   return '개인정보 수집·이용에 동의해 주세요.';
  if (m.includes('invalid_name'))         return '이름을 확인해 주세요.';
  if (m.includes('invalid_phone'))        return '연락처를 정확히 입력해 주세요. (숫자 9~11자리)';
  if (m.includes('invalid_address'))      return '주소(지역)를 입력해 주세요.';
  if (m.includes('invalid_service_type')) return '서비스 종류를 선택해 주세요.';
  return '잠시 후 다시 시도해 주세요.';
}

// ============================================================
// 0. Ticker — 30s linear infinite
// ============================================================
function Ticker() {
  const set = (
    <>
      <span className="ldg-ticker-item"><span style={{ color: "#E0673D" }}>★</span> 고객 만족도 <span style={{ color: "#E0673D" }}>98%</span></span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item"><span style={{ color: "#5B9BD5" }}>❄</span> 누적 작업 <span style={{ color: "#E0673D" }}>5,000건+</span></span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item">서울·경기 <span style={{ color: "#FFC79A", fontWeight: 800 }}>당일 출장</span></span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item">전 브랜드 냉매충전 가능</span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item">정품 냉매 R-22 · R-410A</span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item">냉매충전 · 분해세척 · 누설수리 · 설치</span>
      <span className="ldg-ticker-sep">|</span>
    </>
  );
  return (
    <div className="ldg-ticker">
      <div className="ldg-ticker-track">{set}{set}</div>
    </div>
  );
}

// ============================================================
// 1. Sticky Header
// ============================================================
function Header() {
  return (
    <header className="ldg-header">
      <div className="ldg-header-inner">
        <a href="#top"><img className="ldg-header-logo" src="/landing/assets/logo_color.png" alt="올데이케어 로고" /></a>
        <a className="ldg-header-cta" href={PHONE_TEL}>
          <PhoneIcon size={14} />
          {PHONE_DISPLAY}
        </a>
      </div>
    </header>
  );
}

// ============================================================
// 2. HERO — 좌: 헤드라인 + 미니 게이지 / 우: 접수 폼 카드
// ============================================================
function Hero() {
  const windText = "안 시원하면?";
  return (
    <section className="ldg-hero" id="01-hero" style={{ position: "relative", overflow: "hidden" }}>
      <div className="ldg-hero-heat" aria-hidden="true" />
      <div className="ldg-container ldg-hero-grid" style={{ position: "relative", zIndex: 1 }}>
        <div className="ldg-hero-left">
          <div className="ldg-hero-badges">
            <span className="ldg-hero-badge urgent">긴급 출동 가능</span>
            <span className="ldg-hero-badge blue">서울·경기 당일 출장</span>
          </div>

          <h1 className="ldg-hero-h1">
            또 여름인데,<br />
            작년처럼<br />
            <span style={{ color: "#809df0" }}>
              {windText.split("").map((ch, i) => (
                <span key={i} className="wind-char" style={{ animationDelay: `${i * 0.12}s` }}>
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </span>
          </h1>

          <p className="ldg-hero-lead">
            냉매 부족이 가장 흔한 원인입니다.<br />
            올데이케어 전문 기사가 진단부터 해결까지<br />
            당일 처리해드립니다.
          </p>

          <div className="ldg-hero-cta">
            <a className="ldg-cta-main" href={PHONE_TEL}>
              <PhoneIcon size={19} />{PHONE_DISPLAY}
            </a>
          </div>

          <div className="ldg-hero-aside">
            <span className="ldg-pill-info">10초면 접수 완료</span>
            <span>복잡한 절차 없이, 연락처만 남기면 끝 · 당일 연락</span>
          </div>
        </div>

        <aside className="ldg-hero-form-card">
          <div className="ldg-hero-form-head">
            <span className="ldg-hero-form-eyebrow">QUICK BOOKING</span>
            <h2 className="ldg-hero-form-title">지금 바로 접수하기</h2>
            <p className="ldg-hero-form-sub">연락처만 남기면 끝 · 당일 연락드립니다</p>
          </div>
          <HeroBookingForm />
        </aside>
      </div>

      {/* Hero 끝 wave — 정답 dc.html line 152~156 */}
      <div style={{ marginTop: 72, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 56" preserveAspectRatio="none"
             style={{ display: "block", width: "100%", height: 56 }} aria-hidden="true">
          <path d="M0,28 C360,4 1080,48 1440,22 L1440,56 L0,56 Z" fill="#ffffff" />
        </svg>
      </div>
    </section>
  );
}

// ============================================================
// 진단 다이얼 — 28°C→21°C, 색 보간, proof 0/1/2 크로스페이드,
// proof-0 안에 실시간 고객 문의 채팅 시뮬레이션 (live dot + sweat 아바타 + 타이핑)
// Evidence 섹션 안 BeforeAfterSlider 아래에 배치 (2026-06-24)
// ============================================================
const CHAT_TYPE_FULL = "하나도 안 시원해요…\n고객님 문의가 들어왔어요";

function DiagnosisDial() {
  const [temp, setTemp]   = useState(28);
  const [proof, setProof] = useState(0);
  const [step, setStep]   = useState(1);
  const [ripple, setRipple] = useState(0);
  const [chat, setChat]   = useState("");
  const tokenRef = useRef(0);
  const wrapRef  = useRef(null);
  const autoRef  = useRef(false);

  function play() {
    const myToken = ++tokenRef.current;
    setTemp(28); setProof(0); setStep(1); setRipple(0); setChat("");
    const start = performance.now();
    let rippled = false;

    function typeChat(i) {
      if (myToken !== tokenRef.current) return;
      setChat(CHAT_TYPE_FULL.slice(0, i));
      if (i < CHAT_TYPE_FULL.length) {
        const ch = CHAT_TYPE_FULL[i];
        const d = ch === "\n" ? 180 : 38 + Math.random() * 38;
        setTimeout(() => typeChat(i + 1), d);
      }
    }
    setTimeout(() => typeChat(1), 100);

    function frame(now) {
      if (myToken !== tokenRef.current) return;
      const t = now - start;
      if (t < 1150) {
        setProof(0); setStep(1); setTemp(28);
      } else if (t < 2550) {
        setProof(1); setStep(2); setTemp(28);
      } else if (t < 4050) {
        const p = (t - 2550) / 1500;
        const v = 28 - (28 - 21) * Math.min(1, p);
        setProof(2); setStep(3); setTemp(Math.round(v * 10) / 10);
      } else {
        setProof(2); setStep(3); setTemp(21);
        if (!rippled) { rippled = true; setRipple(r => r + 1); }
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !autoRef.current) {
          autoRef.current = true;
          play();
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.4 });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  const ratio = Math.max(0, Math.min(1, (28 - temp) / 7));
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  const r = lerp(220, 37, ratio);
  const g = lerp(38, 99, ratio);
  const b = lerp(38, 235, ratio);
  const arcColor = `rgb(${r}, ${g}, ${b})`;

  const R = 82;
  const C = 2 * Math.PI * R;
  const arcLen = 90 + (270 - 90) * ratio;
  const dash = (arcLen / 360) * C;

  return (
    <div className="ldg-dial-wrap" ref={wrapRef}>
      <div className="ldg-dial-head-r">
        <button className="ldg-dial-replay" onClick={() => { autoRef.current = true; play(); }}>↻ 다시 보기</button>
      </div>

      <div className="ldg-dial-body2">
        <div className="ldg-dial-col">
          <div className="ldg-dial-gauge" style={{ position: "relative" }}>
            <span key={ripple} className={`ldg-dial-ripple ${ripple > 0 ? "fire" : ""}`} aria-hidden="true" />
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="82" fill="none" stroke="#DCE8F3" strokeWidth="11" />
              <circle cx="100" cy="100" r="82" fill="none"
                      stroke={arcColor} strokeWidth="11"
                      strokeDasharray={`${dash} ${C}`}
                      strokeLinecap="round"
                      transform="rotate(135 100 100)"
                      style={{ transition: "stroke 0.3s ease" }} />
            </svg>
            <div className="ldg-dial-gauge-text">
              <span className="ldg-dial-gauge-num">
                {Number.isInteger(temp) ? temp : temp.toFixed(1)}
              </span>
              <span className="ldg-dial-gauge-lbl">°C 냉방</span>
            </div>
          </div>
          <span className="ldg-dial-cap">
            {step === 1 && "틀어도 바람만 · 안 시원해요"}
            {step === 2 && "진단 중 — 전문 게이지로 측정"}
            {step === 3 && temp > 21 && "정품 냉매 충전 중…"}
            {step === 3 && temp <= 21 && "✓ 21°C — 시원하게 회복"}
          </span>
        </div>

        <div className="ldg-proof">
          <div className={`ldg-proof-layer ${proof === 0 ? "active" : ""}`}>
            <div className="ldg-proof0-bg" />
            <div className="ldg-proof0-live">
              <span className="ldg-live-dot" />
              <span>실시간 고객 문의</span>
            </div>
            <div className="ldg-proof0-chat">
              <div className="ldg-proof0-avatar">
                <span className="ldg-sweat-drip" />
              </div>
              <div className="ldg-proof0-bubble">
                <span style={{ whiteSpace: "pre-line" }}>{chat}</span>
                <span className="ldg-proof0-caret" />
              </div>
            </div>
          </div>
          <div className={`ldg-proof-layer ${proof === 1 ? "active" : ""}`}>
            <img src="/landing/assets/gauge_real.jpg" alt="냉매 게이지로 압력 측정" style={{ objectPosition: "center 28%" }} />
            <div className="ldg-proof-badge">진단 중</div>
            <div className="ldg-proof-text-bottom">전문 게이지로 냉매압력을<br/>직접 측정합니다</div>
          </div>
          <div className={`ldg-proof-layer ${proof === 2 ? "active" : ""}`}>
            <img src="/landing/assets/charge_real.png" alt="정품 냉매 충전 · 21도 확인" style={{ objectPosition: "center 42%" }} />
            <div className="ldg-proof-badge done">충전 완료</div>
            <div className="ldg-proof-text-bottom">정품 냉매 충전 · 적외선 온도계로<br/>21°C 직접 확인</div>
          </div>
        </div>

        <div className="ldg-dial-steps">
          <div className={`ldg-dial-step ${step >= 1 ? "active" : ""}`}>
            <span className="ldg-dial-step-num">1</span>증상
          </div>
          <div className={`ldg-dial-step ${step >= 2 ? "active" : ""}`} style={{ flex: 1.25 }}>
            <span className="ldg-dial-step-num">2</span>측정·충전
          </div>
          <div className={`ldg-dial-step ${step >= 3 ? "active" : ""}`}>
            <span className="ldg-dial-step-num">3</span>완료
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. WHY — 말풍선 타이핑 + 인라인 배지 + 정답 카드 구조
// ============================================================
function useTypewriter(ref, fullText, stagger = 0) {
  const [show, setShow] = useState(fullText);
  const startedRef = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          setTimeout(() => {
            setShow("");
            let i = 0;
            function next() {
              i++;
              setShow(fullText.slice(0, i));
              if (i < fullText.length) {
                const ch = fullText[i];
                const d = ch === "\n" ? 220 : 58 + Math.random() * 46;
                setTimeout(next, d);
              }
            }
            next();
          }, stagger);
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 });
    io.observe(ref.current);
    const fb = setTimeout(() => { if (!startedRef.current) { startedRef.current = true; setShow(fullText); } }, 2000);
    return () => { io.disconnect(); clearTimeout(fb); };
  }, [ref, fullText, stagger]);
  return show;
}

function WhyBubble({ text, stagger, caretColor, bg, border }) {
  const ref = useRef(null);
  const shown = useTypewriter(ref, text, stagger);
  return (
    <div ref={ref}
         className="ldg-why-bubble"
         style={{ background: bg || "#fff", border: `1px solid ${border || "#E9EFF6"}`, whiteSpace: "pre-line" }}>
      <span>{shown}</span>
      <span className="ldg-why-bubble-caret" style={{ background: caretColor || "#9BB4CC" }} />
    </div>
  );
}

function Why({ scrollToForm }) {
  function onSolveClick(e, service) {
    e.preventDefault();
    scrollToForm(service);
  }
  return (
    <section className="ldg-section" id="02-cause" style={{ background: "#fff", padding: "88px 24px 104px" }}>
      <div className="ldg-container">
        <p className="ldg-eyebrow">WHY</p>
        <h2 className="ldg-h2">{"안 시원한 데는\n이유가 있습니다"}</h2>
        <p className="ldg-lead" style={{ maxWidth: 520 }}>이런 증상, 익숙하시죠? 증상마다 원인과 해결법이 다릅니다.</p>

        <div className="ldg-why-grid">
          {/* 카드 1 — 강조 */}
          <article className="ldg-why-card hot">
            <div className="ldg-why-symptom">
              <span className="ldg-why-dot" style={{ background: "#5B9BD5" }} />
              <span className="ldg-why-sym-lbl" style={{ color: "#4A82B8" }}>이런 증상이라면</span>
            </div>
            <WhyBubble text={"틀어도 바람만 나오고\n하나도 안 시원해요"} stagger={0}
                       caretColor="#5B9BD5" bg="#fff" border="#E2EDF8" />
            <div className="ldg-why-cause">
              <DownArrowIcon />
              <span>예상 원인</span>
            </div>
            <h3 className="ldg-why-h3">
              냉매 부족
              <span className="ldg-why-blink">가장 흔한 원인</span>
            </h3>
            <p className="ldg-why-desc">냉매가 줄거나 누설되면 냉방 효과가 급격히 떨어집니다. 정기 점검이 필요합니다.</p>
            <a href="#form" className="ldg-why-solve filled" onClick={(e) => onSolveClick(e, "냉매충전")}>냉매충전으로 해결 →</a>
          </article>

          {/* 카드 2 */}
          <article className="ldg-why-card">
            <div className="ldg-why-symptom">
              <span className="ldg-why-dot" style={{ background: "#C2D2E2" }} />
              <span className="ldg-why-sym-lbl">이런 증상이라면</span>
            </div>
            <WhyBubble text={"에어컨에서 냄새 나고\n바람도 약해요"} stagger={320}
                       caretColor="#9BB4CC" bg="#F7FBFF" border="#E9EFF6" />
            <div className="ldg-why-cause">
              <DownArrowIcon />
              <span>예상 원인</span>
            </div>
            <h3 className="ldg-why-h3">필터·송풍팬 오염</h3>
            <p className="ldg-why-desc">먼지와 곰팡이가 쌓이면 바람이 약해지고 냄새가 납니다. 내부 오염이 심한 경우가 많습니다.</p>
            <a href="#form" className="ldg-why-solve outline" onClick={(e) => onSolveClick(e, "분해세척")}>분해세척으로 해결 →</a>
          </article>

          {/* 카드 3 */}
          <article className="ldg-why-card">
            <div className="ldg-why-symptom">
              <span className="ldg-why-dot" style={{ background: "#C2D2E2" }} />
              <span className="ldg-why-sym-lbl">이런 증상이라면</span>
            </div>
            <WhyBubble text={"갑자기 에러 코드 뜨고\n에어컨이 꺼져요"} stagger={640}
                       caretColor="#9BB4CC" bg="#F7FBFF" border="#E9EFF6" />
            <div className="ldg-why-cause">
              <DownArrowIcon />
              <span>예상 원인</span>
            </div>
            <h3 className="ldg-why-h3">부품 고장</h3>
            <p className="ldg-why-desc">압축기·팽창밸브 등 핵심 부품 이상은 전문 진단이 필요합니다. 에러 코드·전원 차단은 점검 신호입니다.</p>
            <a href="#form" className="ldg-why-solve outline" onClick={(e) => onSolveClick(e, "수리·누설수리")}>방문 진단으로 확인 →</a>
          </article>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 4. SOLUTION
// ============================================================
function Solution() {
  return (
    <section className="ldg-section ldg-solution" id="03-solution">
      <div className="ldg-container">
        <p className="ldg-eyebrow">SOLUTION</p>
        <div className="ldg-soln-head">
          <h2 className="ldg-h2">{"전문 기사가\n진단부터 해결까지"}</h2>
          <div className="ldg-soln-pill">
            <CheckCircleIcon /> 전 브랜드 냉매충전 가능
          </div>
        </div>

        <div className="ldg-soln-grid">
          <article className="ldg-soln-card">
            <div className="ldg-soln-photo">
              <img src="/landing/assets/charge.jpg" alt="실외기 냉매 충전 작업 현장" style={{ objectPosition: "center 30%" }} />
              <div className="ldg-soln-photo-badge" style={{ background: "#E0673D" }}>주력 서비스</div>
            </div>
            <div className="ldg-soln-body">
              <h3>냉매충전</h3>
              <p>냉매량 점검 후 부족 시 보충 또는 교체. 냉방 성능을 즉시 회복합니다.</p>
              <div className="ldg-soln-list">
                <div><span /> 냉매 누수 점검 포함</div>
                <div><span /> 정품 냉매 사용 (R-22·R-410A)</div>
                <div><span /> 당일 출장 가능</div>
              </div>
            </div>
          </article>

          <article className="ldg-soln-card">
            <div className="ldg-soln-photo">
              <img src="/landing/assets/wash.jpg" alt="천장형 에어컨 분해세척 작업" style={{ objectPosition: "center 40%" }} />
              <div className="ldg-soln-photo-badge" style={{ background: "#809df0" }}>먼지·필터 청소</div>
            </div>
            <div className="ldg-soln-body">
              <h3>분해세척</h3>
              <p>필터·열교환기·송풍팬 분해 후 세척. 냄새와 오염을 근본부터 제거합니다.</p>
              <div className="ldg-soln-list">
                <div><span /> 벽걸이·스탠드·시스템에어컨</div>
                <div><span /> 곰팡이·세균까지 제거</div>
                <div><span /> 당일 출장 가능</div>
              </div>
            </div>
          </article>
        </div>

        <div className="ldg-soln-one">
          <WrenchIcon />
          <p><strong>수리·설치도 가능합니다</strong> — 방문 진단 후 안내해드립니다.</p>
        </div>
      </div>

      {/* Solution 끝 wave — 정답 dc.html line 280~283 */}
      <div style={{ marginTop: 80, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 56" preserveAspectRatio="none"
             style={{ display: "block", width: "100%", height: 56 }} aria-hidden="true">
          <path d="M0,24 C480,52 960,4 1440,32 L1440,56 L0,56 Z" fill="#ffffff" />
        </svg>
      </div>
    </section>
  );
}

// ============================================================
// 5. PRICE
// ============================================================
// 분해세척 표 제거 (사장님 spec — 견적 상이로 가격 미표시).
const CHARGE_ROWS = [
  { name: "벽걸이",                          sale: 70000   },
  { name: "스탠드",                          sale: 80000   },
  { name: "2 IN 1",                          sale: 100000  },
  { name: "천장형", aux: " (1WAY)",          sale: 90000   },
  { name: "천장형", aux: " (4WAY)",          sale: "전화 상담" },
  { name: "누설 수리",                       sale: "전화 상담" },
];

function won(n, tilde = false) {
  if (typeof n === "string") return n;
  return n.toLocaleString("ko-KR") + "원" + (tilde ? "~" : "");
}

function Price({ scrollToForm }) {
  return (
    <section className="ldg-section" id="03b-price" style={{ background: "#fff", padding: "96px 24px 100px" }}>
      <div className="ldg-container">
        <p className="ldg-eyebrow">PRICE</p>
        <h2 className="ldg-h2" style={{ marginBottom: 14 }}>비용, 미리 알려드립니다</h2>
        <p className="ldg-lead">
          현장에서 서비스 전 <strong style={{ color: "#1C2B3A", fontWeight: 700 }}>정확한 견적을 안내</strong>드리고,&nbsp;
          <strong style={{ color: "#1C2B3A", fontWeight: 700 }}>동의하신 금액으로만</strong> 진행합니다.&nbsp;
          <span style={{ color: "#93A2B4" }}>분해세척은 기종별 할인가, 냉매충전은 보충가 기준입니다.</span>
        </p>

        <div className="ldg-price-grid">
          {/* 좌측 컬럼 — 분해세척 + 수리·설치 세로 (오른쪽 냉매충전 표와 높이 균형) */}
          <div className="ldg-price-col-left">
            {/* 분해세척 — 가격 표 X, 작업 범위만 + 견적 안내 (사장님 spec) */}
            <div className="ldg-price-card">
              <h3>분해세척</h3>
              <p className="ldg-wash-scope">필터·송풍팬·열교환기까지 전면 분해세척.</p>
              <ul className="ldg-wash-list">
                <li>전면 분해 후 안쪽까지 세척</li>
                <li>곰팡이·세균까지 제거</li>
                <li>벽걸이·스탠드·시스템에어컨</li>
              </ul>
              <div className="ldg-wash-note">기종·오염도에 따라 견적 상이 — 방문 진단 후 안내드립니다.</div>
              <a href="#form" className="ldg-price-cta" onClick={(e) => { e.preventDefault(); scrollToForm("분해세척"); }}>지금 분해세척 접수하기 →</a>
            </div>

            {/* 수리·설치 — 가격 X, 텍스트만 + 상담 CTA (사장님 spec) */}
            <div className="ldg-price-card">
              <h3>수리·설치</h3>
              <p className="ldg-wash-scope">전문 팀이 수리부터 설치·이전까지.</p>
              <ul className="ldg-wash-list">
                <li>누설 수리 · 부품 교체</li>
                <li>에어컨 설치 · 이전 설치</li>
                <li>실외기 점검 · 진단</li>
              </ul>
              <div className="ldg-wash-note">방문 진단 후 정확한 견적을 안내드립니다.</div>
              <a href="#form" className="ldg-price-cta" onClick={(e) => { e.preventDefault(); scrollToForm("수리·누설수리"); }}>수리·설치 상담하기 →</a>
            </div>
          </div>

          {/* 냉매충전 */}
          <div className="ldg-price-card">
            <div className="ldg-price-title">
              <h3>냉매충전</h3>
              <span className="ldg-price-sub">(가스충전)</span>
            </div>
            <div className="ldg-price-thead-2">
              <span className="hd">기종</span>
              <span className="hd sale">보충 시작가</span>
            </div>
            {CHARGE_ROWS.map((r, i) => (
              <div key={i} className="ldg-price-row-2">
                <span className="name">{r.name}{r.aux && <span className="aux">{r.aux}</span>}</span>
                {typeof r.sale === "string" ? (
                  <span className="phone-chat">{r.sale}</span>
                ) : (
                  <span className="sale">{won(r.sale, true)}</span>
                )}
              </div>
            ))}
            <div className="ldg-price-note">+ 완충 시 30,000원 추가</div>
            <div className="ldg-price-warn">※ 기계 고장·실외기 접근 불가로 인해 충전을 못할 경우 출장비 30,000원이 발생합니다.</div>
            <a href="#form" className="ldg-price-cta" onClick={(e) => { e.preventDefault(); scrollToForm("냉매충전"); }}>냉매충전 접수하기 →</a>
          </div>
        </div>

        <p className="ldg-price-disclaimer">* 정확한 금액은 방문 진단 후 확정되며, 추가 비용은 사전 동의 후에만 청구됩니다.</p>
      </div>
    </section>
  );
}

// ============================================================
// 6. EVIDENCE — Before/After + 4단계
// ============================================================
function BeforeAfterSlider() {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    let raf;
    function nudge(now) {
      const t = (now - t0) / 1000;
      if (t > 1.4) return;
      const p = 50 + Math.sin(t * Math.PI * 2) * 6 * (1 - t / 1.4);
      setPos(p);
      raf = requestAnimationFrame(nudge);
    }
    const tm = setTimeout(() => { raf = requestAnimationFrame(nudge); }, 600);
    return () => { clearTimeout(tm); cancelAnimationFrame(raf); };
  }, []);

  function clamp(p) { return Math.max(0, Math.min(100, p)); }
  function posFromEvent(e) {
    const wrap = wrapRef.current; if (!wrap) return 50;
    const rect = wrap.getBoundingClientRect();
    return clamp(((e.clientX ?? 0) - rect.left) / rect.width * 100);
  }
  function onPointerDown(e) {
    draggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    setPos(posFromEvent(e));
  }
  function onPointerMove(e) { if (draggingRef.current) setPos(posFromEvent(e)); }
  function onPointerUp(e) {
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  return (
    <div ref={wrapRef} className="ldg-evi-slider"
         style={{ "--ldg-pos": `${pos}%`, "--ldg-clip": `${100 - pos}%` }}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove}
         onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <img className="ldg-evi-img after" src="/landing/assets/after.jpg" alt="세척 후" draggable={false} />
      <span className="ldg-evi-badge after">세척 후</span>
      <img className="ldg-evi-img before" src="/landing/assets/before.jpg" alt="세척 전" draggable={false} />
      <span className="ldg-evi-badge before">세척 전</span>
      <div className="ldg-evi-handle" />
      <div className="ldg-evi-knob">⟷</div>
    </div>
  );
}

const PROCESS_STEPS = [
  { tag: "STEP 01", title: "10초 접수",        rest: "전화·온라인으로 ", strong: "연락처만 남기면 끝." },
  { tag: "STEP 02", title: "담당 기사 연락",   rest: "담당 기사가 직접 연락 드려 ", strong: "상담 후 방문 일정을 조율", suffix: "합니다." },
  { tag: "STEP 03", title: "방문 진단 · 견적", rest: "현장에서 상태를 확인하고 ", strong: "서비스 전 정확한 견적", suffix: "을 안내합니다." },
  { tag: "STEP 04", title: "작업 · 결과 확인", rest: "동의하신 금액으로 ", strong: "정품 자재 작업 후 결과를 함께 확인합니다." },
];

function Evidence() {
  return (
    <section className="ldg-section" id="04-evidence" style={{ background: "#fff", padding: "100px 24px 72px" }}>
      <div className="ldg-container">
        <p className="ldg-eyebrow">BEFORE / AFTER</p>
        <h2 className="ldg-h2" style={{ marginBottom: 40 }}>{"말 대신\n보여드립니다"}</h2>

        <BeforeAfterSlider />
        <p className="ldg-evi-cap">손잡이를 끌어 세척 전 ↔ 세척 후를 직접 비교 · 열교환기 핀 클로즈업</p>

        <div className="ldg-evi-dial-card">
          <h3 className="ldg-evi-dial-h3">진단 시퀀스 — 28°C → 21°C 회복</h3>
          <p className="ldg-evi-dial-sub">증상 접수부터 정품 냉매 충전 · 21°C 회복까지, 실제 작업 흐름입니다</p>
          <DiagnosisDial />
        </div>

        <div className="ldg-steps-grid" style={{ marginTop: 40 }}>
          {PROCESS_STEPS.map((s, i) => (
            <div key={i} className="ldg-step-card">
              <div className="ldg-step-num">{i + 1}</div>
              <span className="ldg-step-tag">{s.tag}</span>
              <h4>{s.title}</h4>
              <p>
                {s.rest}
                <strong>{s.strong}</strong>
                {s.suffix || ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence 끝 다크 wave — 그라데이션 없이 깔끔한 흰→다크 전환 */}
      <div style={{ marginTop: 80, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 56" preserveAspectRatio="none"
             style={{ display: "block", width: "100%", height: 56 }} aria-hidden="true">
          <path d="M0,28 C360,4 1080,48 1440,22 L1440,56 L0,56 Z" fill="#1C2B3A" />
        </svg>
      </div>
    </section>
  );
}

// ============================================================
// 7. (Bridge 그라데이션 제거 — Evidence 끝 dark wave 로 대체)
// ============================================================

// ============================================================
// 8. TRUST — 통계 + 후기
// ============================================================
function useCountUp(ref, target, duration = 1400) {
  const [v, setV] = useState(0);
  const playedRef = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !playedRef.current) {
          playedRef.current = true;
          const start = performance.now();
          function frame(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, target, duration]);
  return v;
}

function StatNum({ target, plus }) {
  const ref = useRef(null);
  const v = useCountUp(ref, target);
  return (
    <div ref={ref} className="ldg-stat-num">
      {v.toLocaleString("ko-KR")}{plus && <span className="ldg-stat-plus">+</span>}
    </div>
  );
}

const REVIEWS = [
  { text: "당일 바로 방문해서 1시간도 안 걸려 끝났어요. 소요 시간이 짧은데도 확실하게 시원해졌습니다.", name: "김*진", detail: "냉매충전 · 서울 마포구" },
  { text: "분해세척 처음 받아봤는데, 안에 곰팡이가 이렇게 많은지 몰랐어요. 직접 보여주시니 믿음이 갔고 바람도 훨씬 강해졌습니다.", name: "이*현", detail: "분해세척 · 경기 성남시" },
  { text: "바람은 나오는데 안 시원해 바로 전화드렸더니, 그날 바로 오셔서 저를 살려주셨네요. 감사합니다.", name: "박*수", detail: "냉매충전 · 서울 강서구" },
];

function Trust() {
  return (
    <section className="ldg-trust" id="05-reassurance">
      <div className="ldg-container">
        <div className="ldg-stats">
          <div>
            <div className="ldg-stat-icon"><ClipboardIcon /></div>
            <StatNum target={5000} plus />
            <div className="ldg-stat-lbl">누적 작업 건수</div>
          </div>
          <div>
            <div className="ldg-stat-icon"><UserIcon /></div>
            <StatNum target={30} plus />
            <div className="ldg-stat-lbl">전문 기사</div>
          </div>
          <div>
            <div className="ldg-stat-icon"><CalendarIcon /></div>
            <StatNum target={365} />
            <div className="ldg-stat-lbl">연중무휴 케어</div>
          </div>
        </div>

        <h3 className="ldg-trust-h3">실제 이용 후기</h3>
        <div className="ldg-reviews-grid">
          {REVIEWS.map((r, i) => (
            <div className="ldg-review-card" key={i}>
              <div className="ldg-review-stars">★★★★★</div>
              <p className="ldg-review-text">{r.text}</p>
              <div className="ldg-review-name">{r.name}</div>
              <div className="ldg-review-detail">{r.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 9. FORM — 폼 본문은 BookingFormBody 로 공유 (히어로 우측 + 맨 아래)
// ============================================================
function useBookingForm() {
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [form, setForm] = useState({ service: "", name: "", phone: "", address: "", consent: false });
  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); setError(null); }

  // 클라 검증 — 제출 버튼 활성 조건 (사장님 약점 #1)
  const canSubmit =
    !!form.service &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.address.trim().length > 0 &&
    form.consent === true;

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !canSubmit) return;   // 더블서밋 + 비활성 가드
    setSubmitting(true);
    setError(null);
    try {
      const serviceType = SERVICE_CODE[form.service] ?? 'unknown';
      const { error: rpcErr } = await supabase.rpc('create_inquiry', {
        p_service_type:   serviceType,
        p_name:           form.name.trim(),
        p_phone:          form.phone.trim(),
        p_address:        form.address.trim(),
        p_agreed_privacy: form.consent === true,
      });
      if (rpcErr) throw rpcErr;
      // 2026-07-10 — GA4 전환 이벤트. service_type 만 (PII 절대 X).
      //   gtag stub 은 main.jsx 에서 랜딩 host + PROD 조건 만족 시 초기화됨.
      //   운영 PWA 화면에서는 window.gtag 미정의 → guard 로 no-op.
      // 2026-07-10 진단 — 발화 여부 확인 위해 콘솔 로그 (GA4 Realtime 지연 대비).
      //   event_callback: GA4 서버 전송 완료 시 콜백 → 실전송 확인.
      try {
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
          const params = {
            service_type: serviceType,
            event_callback: () => { console.log("[GA4] generate_lead → sent", serviceType); },
          };
          window.gtag("event", "generate_lead", params);
          console.log("[GA4] generate_lead → queued", serviceType);
        } else {
          console.warn("[GA4] window.gtag not defined — event skipped", { host: window?.location?.hostname });
        }
      } catch (gaErr) {
        // GA 실패는 접수 성공에 영향 X (하지만 원인 파악 위해 로그).
        console.warn("[GA4] generate_lead throw", gaErr);
      }
      // 2026-07-11 — 네이버 전환 이벤트 (프리미엄 로그분석). 접수완료를 "신청" 전환으로 기록.
      //   공통 스크립트(wcslog.js)는 main.jsx 에서 랜딩 host + PROD 조건에서 로드됨.
      //   window.wcs 없으면 no-op (운영 PWA·차단기 대비). PII 없이 전환 유형/값만 전송.
      try {
        if (typeof window !== "undefined" && window.wcs && typeof window.wcs.cnv === "function") {
          const _nasa = {};
          _nasa["cnv"] = window.wcs.cnv("2", "1"); // 2 = 신청/예약 전환
          if (typeof window.wcs_do === "function") window.wcs_do(_nasa);
          console.log("[NAVER] 전환 전송", serviceType);
        }
      } catch (nvErr) {
        // 네이버 전환 실패는 접수 성공에 영향 X.
        console.warn("[NAVER] cnv throw", nvErr);
      }
      setSubmitted(true);
    } catch (e2) {
      setError(messageFor(e2));
      setSubmitting(false);   // 실패 시 재시도 가능하게 풀기 (성공은 setSubmitted 로 화면 전환되므로 풀 필요 X)
    }
  }
  return { form, set, handleSubmit, submitted, submitting, error, canSubmit };
}

// prefillService 가 바뀌면 폼의 service 필드 자동 동기화 (Price 카드에서 종류 사전 선택)
function usePrefillSync(set, prefillService) {
  useEffect(() => {
    if (prefillService) set("service", prefillService);
  }, [prefillService]); // eslint-disable-line react-hooks/exhaustive-deps
}

function BookingFormBody({ form, set, onSubmit, submitted, submitting, error, canSubmit, showTel = true }) {
  if (submitted) {
    return (
      <div className="ldg-form-done">
        <div className="ldg-form-done-ico"><CheckIcon /></div>
        <h3>접수 완료되었습니다</h3>
        <p>빠른 시간 내 연락드리겠습니다.<br/>긴급 상담은 <a href={PHONE_TEL}>{PHONE_DISPLAY}</a>으로 전화해 주세요.</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="ldg-form">
      <div>
        <label className="ldg-form-label">서비스 종류</label>
        <select value={form.service} onChange={(e) => set("service", e.target.value)} className="ldg-form-input" disabled={submitting}>
          <option value="">선택해 주세요</option>
          <option value="냉매충전">냉매충전</option>
          <option value="분해세척">분해세척</option>
          <option value="수리·누설수리">수리 / 누설수리</option>
          <option value="에어컨 설치">에어컨 설치</option>
          <option value="잘 모르겠어요">잘 모르겠어요 (방문 후 진단)</option>
        </select>
      </div>

      <div className="ldg-form-2col">
        <div>
          <label className="ldg-form-label">이름</label>
          <input type="text" placeholder="홍길동" className="ldg-form-input" disabled={submitting}
                 value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="ldg-form-label">연락처</label>
          <input type="tel" placeholder="010-0000-0000" className="ldg-form-input" disabled={submitting}
                 value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="ldg-form-label">주소 (지역)</label>
        <input type="text" placeholder="예: 서울 마포구 서교동" className="ldg-form-input" disabled={submitting}
               value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>

      <label className="ldg-form-consent">
        <input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} disabled={submitting} />
        <span>
          <strong>[필수]</strong> 개인정보 수집·이용에 동의합니다. 수집 항목(이름·연락처·주소)은 출장 접수 목적으로만 사용되며, 관련 법령에 따라 일정 기간 보관 후 파기됩니다.{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer"
             style={{ color: "#2563EB", textDecoration: "underline", fontWeight: 700 }}>
            개인정보처리방침 보기
          </a>
        </span>
      </label>

      {error && <p className="ldg-form-error" role="alert">{error}</p>}

      <button type="submit" className="ldg-form-submit" disabled={!canSubmit || submitting}>
        {submitting ? "접수 중…" : "접수하기"}
      </button>

      {showTel && (
        <p className="ldg-form-tel">전화 접수: <a href={PHONE_TEL}>{PHONE_DISPLAY}</a></p>
      )}
    </form>
  );
}

function HeroBookingForm() {
  const bf = useBookingForm();
  return (
    <BookingFormBody
      form={bf.form} set={bf.set} onSubmit={bf.handleSubmit}
      submitted={bf.submitted} submitting={bf.submitting} error={bf.error} canSubmit={bf.canSubmit}
      showTel={false}
    />
  );
}

function CtaForm({ prefillService }) {
  const bf = useBookingForm();
  usePrefillSync(bf.set, prefillService);
  return (
    <section className="ldg-section ldg-form-section" id="form">
      <div className="ldg-form-container">
        <div className="ldg-form-head">
          <p className="ldg-eyebrow">BOOKING</p>
          <h2 className="ldg-h2" style={{ fontSize: "clamp(26px, 4.5vw, 44px)" }}>{"시원하지 않으면,\n냉매 점검부터"}</h2>
          <p className="ldg-lead" style={{ marginBottom: 0 }}>서울·경기 전 지역 당일 출장</p>
        </div>
        <BookingFormBody
          form={bf.form} set={bf.set} onSubmit={bf.handleSubmit}
          submitted={bf.submitted} submitting={bf.submitting} error={bf.error} canSubmit={bf.canSubmit}
        />
      </div>
    </section>
  );
}

// ============================================================
// 10. Footer
// ============================================================
function Footer() {
  return (
    <footer className="ldg-footer">
      <div className="ldg-container">
        <img src="/landing/assets/logo_white.png" alt="올데이케어" />
        <p className="ldg-footer-info">
          대표 조동욱, 구현서 &nbsp;·&nbsp; 사업자등록번호 430-07-03167<br/>
          상호: 에어컨청소 에어컨가스충전 올데이케어 &nbsp;·&nbsp; 경기도 고양시 덕양구 상막3길 5, 1동 805호<br/>
          서울·경기 전 지역 출장 · 냉매충전 · 분해세척 · 누설수리 · 설치
        </p>
        <p className="ldg-footer-tel">대표전화 <a href={PHONE_TEL}>{PHONE_DISPLAY}</a></p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 14, letterSpacing: "-0.1px" }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer"
             style={{ color: "rgba(255,255,255,0.9)", textDecoration: "underline", fontWeight: 700 }}>
            개인정보처리방침
          </a>
        </p>
        <p className="ldg-footer-copyr">© 2026 올데이케어. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ============================================================
// 11. Sticky Bar
// ============================================================
function StickyBar({ onCtaForm }) {
  return (
    <nav className="ldg-sticky">
      <a className="phone" href={PHONE_TEL}>
        <PhoneIcon size={17} /> 전화 연결
      </a>
      <a className="submit" href="#form" onClick={(e) => { e.preventDefault(); onCtaForm(); }}>
        <ArrowRightIcon /> 접수하기
      </a>
    </nav>
  );
}

// ============================================================
// Icons
// ============================================================
function PhoneIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 17 17" fill="none">
      <path d="M2 2.5C2 2.224 2.224 2 2.5 2h2.638c.22 0 .412.142.476.353l1.012 3.544c.073.255-.05.523-.293.63L4.758 7.314a9.056 9.056 0 005.228 5.228l.787-1.575a.5.5 0 01.63-.293l3.544 1.012A.5.5 0 0115.5 12.162V14.5c0 .276-.224.5-.5.5C8.044 15 2 8.956 2 2.5z" fill="currentColor"/>
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="#5B9BD5" strokeWidth="1.2"/>
      <path d="M4.5 7l1.8 1.8L9.5 5" stroke="#5B9BD5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function DownArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v9M3.5 7.5L7 11l3.5-3.5" stroke="#9BB4CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M16 3.5a3 3 0 0 0-4.24 0l-.76.76-1.77-1.77a1 1 0 0 0-1.41 0l-1.18 1.18a1 1 0 0 0 .04 1.37l1.77 1.77L3 12.36V15h2.64l5.55-5.55 1.77 1.77a1 1 0 0 0 1.37.04l1.18-1.18a1 1 0 0 0 0-1.41L13.74 9.9l.76-.76A3 3 0 0 0 16 3.5z"
            stroke="#8AABCA" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M6 16l8 8L26 8" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="2" width="16" height="18" rx="2" stroke="#5B9BD5" strokeWidth="1.4"/>
      <path d="M7 8h8M7 12h5" stroke="#5B9BD5" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M6.5 5.5l1 1 2-2" stroke="#5B9BD5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7" r="4" stroke="#5B9BD5" strokeWidth="1.4"/>
      <path d="M3 19c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="#5B9BD5" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="4" width="18" height="16" rx="2" stroke="#5B9BD5" strokeWidth="1.4"/>
      <path d="M7 2v4M15 2v4M2 9h18" stroke="#5B9BD5" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="11" cy="14" r="1.5" fill="#5B9BD5"/>
    </svg>
  );
}

// ============================================================
// LandingApp root
// ============================================================
// 2026-06-24 — /privacy 경로면 처리방침 페이지. 그 외 기존 마케팅 랜딩.
//   wrapper 로 분리한 이유: hook 호출 전 early return — React hooks 규칙 준수.
export default function LandingApp() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/privacy")) {
    return <PrivacyPage />;
  }
  return <LandingAppMain />;
}

function LandingAppMain() {
  const [prefillService, setPrefillService] = useState("");
  function scrollToForm(service) {
    if (service) setPrefillService(service);
    const el = document.getElementById("form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  // 2026-06-24 — 랜딩 진입 시 탭 제목 올데이케어용으로 (운영 PWA 화면 떠나면 복원).
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "올데이케어 - 에어컨 분해세척·냉매충전·설치·수리";
    return () => { document.title = prevTitle; };
  }, []);

  // 2026-07-01 — Deep-link scroll: external ?page=landing#form entries land
  //   before CtaForm mounts, so a naked hash won't scroll. Wait two rAF ticks
  //   for the form section to be in the DOM + laid out, then scroll into view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#form") return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById("form");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  return (
    <div className="ldg-root" id="top">
      <Ticker />
      <Header />
      <Hero />
      <Why scrollToForm={scrollToForm} />
      <Solution />
      <Price scrollToForm={scrollToForm} />
      <Evidence />
      <Trust />
      <CtaForm prefillService={prefillService} />
      <Footer />
      <StickyBar onCtaForm={scrollToForm} />
    </div>
  );
}
