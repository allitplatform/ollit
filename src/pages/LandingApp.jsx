// 올데이케어 마케팅 랜딩 (2026-06-23, v4).
//   · design_handoff_alldaycare_landing/README.md 재현. Noto Sans KR + 11 섹션.
//   · 1차: UI + 폼 디자인. 백엔드 (inquiries / RPC / 해피콜 인박스) 미연결 — Phase 2.
//   · 자산: public/landing/assets/{logo_color, logo_white, gauge_real, charge_real, charge, wash, before, after}.

import { useEffect, useRef, useState } from "react";
import "../styles/landing.css";

const PHONE_DISPLAY = "1866-2003";
const PHONE_TEL     = "tel:18662003";

// ============================================================
// 0. Ticker
// ============================================================
function Ticker() {
  const items = (
    <>
      <span className="ldg-ticker-item">★ 고객 만족도 <b className="ldg-ticker-hot">98%</b></span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item">❄ 누적 작업 5,000건+</span>
      <span className="ldg-ticker-sep">|</span>
      <span className="ldg-ticker-item"><b className="ldg-ticker-warm">서울·경기 당일 출장</b></span>
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
    <div className="ldg-ticker" aria-label="공지 띠">
      <div className="ldg-ticker-track">
        {items}{items}
      </div>
    </div>
  );
}

// ============================================================
// 1. Header (sticky)
// ============================================================
function Header() {
  return (
    <header className="ldg-header">
      <div className="ldg-header-inner">
        <a href="#top">
          <img className="ldg-header-logo" src="/landing/assets/logo_color.png" alt="올데이케어" />
        </a>
        <a className="ldg-header-cta" href={PHONE_TEL}>
          <PhoneIcon />
          {PHONE_DISPLAY}
        </a>
      </div>
    </header>
  );
}

// ============================================================
// 2. HERO
// ============================================================
const HERO_HEADLINE_LINES = [
  { text: "또 여름인데,", accent: false, wind: false },
  { text: "작년처럼",    accent: false, wind: false },
  { text: "안 시원하면?", accent: true,  wind: true  },
];

function Hero({ onCtaForm }) {
  return (
    <section className="ldg-hero" id="01-hero" style={{ position: "relative", overflow: "hidden" }}>
      <div className="ldg-hero-heat" aria-hidden="true" />
      <div className="ldg-container ldg-hero-grid" style={{ position: "relative", zIndex: 1 }}>
        <div>
          <div className="ldg-hero-badges" style={{ position: "relative" }}>
            <span className="ldg-hero-badge urgent">긴급 출동 가능</span>
            <span className="ldg-hero-badge blue">서울·경기 당일 출장</span>
            <span className="ldg-sweat-drip" aria-hidden="true" />
          </div>

          <h1 className="ldg-hero-h1">
            {HERO_HEADLINE_LINES.map((line, li) => (
              <div key={li} className={line.accent ? "accent" : ""}>
                {line.wind ? (
                  line.text.split("").map((ch, ci) => (
                    <span
                      key={ci}
                      className="wind-char"
                      style={{ animationDelay: `${ci * 0.12}s` }}
                    >
                      {ch === " " ? " " : ch}
                    </span>
                  ))
                ) : line.text}
              </div>
            ))}
          </h1>

          <p className="ldg-hero-lead">
            냉매가 줄어 시원하지 않은 건지, 필터 안쪽이 막힌 건지 — 추측하지 않습니다.
            현장에서 게이지로 직접 확인해 원인을 짚어내고, 부족한 만큼만 정량 충전 / 분해세척까지 한 번에.
          </p>

          <div className="ldg-hero-cta">
            <a className="ldg-cta-main" href={PHONE_TEL}>
              <PhoneIcon size={22} />
              {PHONE_DISPLAY}
            </a>
            <button className="ldg-cta-sub" onClick={onCtaForm}>
              지금 바로 접수하기 →
            </button>
          </div>

          <div className="ldg-hero-aside">
            <span className="ldg-pill-info">10초면 접수 완료</span>
            <span>복잡한 절차 없이, 연락처만 남기면 끝 · 당일 연락</span>
          </div>
        </div>

        <DiagnosisDial />
      </div>
    </section>
  );
}

// ============================================================
// 진단 다이얼 — 28°C → 21°C + 색상 보간 + proof 크로스페이드
// ============================================================
function DiagnosisDial() {
  const [temp, setTemp]   = useState(28);
  const [proof, setProof] = useState(0); // 0/1/2
  const [step, setStep]   = useState(1);
  const [ripple, setRipple] = useState(0); // standalone cRipple — 21 도달 시 1회
  const tokenRef = useRef(0);

  function play() {
    const myToken = ++tokenRef.current;
    setTemp(28); setProof(0); setStep(1); setRipple(0);
    const start = performance.now();
    let rippled = false;
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

  // 스크롤 진입 시 1회 자동재생
  const wrapRef = useRef(null);
  const playedRef = useRef(false);
  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !playedRef.current) {
          playedRef.current = true;
          play();
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.4 });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  // 색상 보간 — 28→21 RED→BLUE
  const ratio = Math.max(0, Math.min(1, (28 - temp) / 7));
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  const RED  = [220, 38, 38];
  const BLUE = [37, 99, 235];
  const r = lerp(RED[0], BLUE[0], ratio);
  const g = lerp(RED[1], BLUE[1], ratio);
  const b = lerp(RED[2], BLUE[2], ratio);
  const color = `rgb(${r}, ${g}, ${b})`;

  // 아크 길이 — temp 28(부족) → 90도, 21(정상) → 270도
  const arcLen = 90 + (270 - 90) * ratio;
  const R = 82;
  const C = 2 * Math.PI * R;
  const dash = (arcLen / 360) * C;

  return (
    <div className="ldg-dial" ref={wrapRef}>
      <div className="ldg-dial-head">
        <span className="ldg-dial-cap">
          <span className="ldg-live-dot" aria-hidden="true" />
          {step === 1 && "증상 확인 중"}
          {step === 2 && "측정 · 충전 진행"}
          {step === 3 && temp <= 21 ? "✓ 시원하게 회복" : (step === 3 && "충전 진행 중")}
        </span>
        <button className="ldg-dial-replay" onClick={() => { playedRef.current = true; play(); }}>
          ↻ 다시 보기
        </button>
      </div>

      <div className="ldg-dial-body">
        <div className="ldg-dial-gauge" style={{ position: "relative" }}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="82" fill="none"
                    stroke="#E6EEF6" strokeWidth="11"/>
            <circle cx="100" cy="100" r="82" fill="none"
                    stroke={color} strokeWidth="11"
                    strokeDasharray={`${dash} ${C}`}
                    strokeLinecap="round"
                    transform="rotate(135 100 100)"
                    style={{ transition: "stroke 0.3s ease" }}/>
          </svg>
          {/* standalone cRipple — 21 도달 1회 발화 */}
          <span key={ripple} className={`ldg-dial-ripple ${ripple > 0 ? "fire" : ""}`} aria-hidden="true" />
          <div className="ldg-dial-gauge-text">
            <div className="ldg-dial-gauge-num" style={{ color }}>
              {Number.isInteger(temp) ? temp : temp.toFixed(1)}
              <span style={{ fontSize: 18, marginLeft: 4 }}>°C</span>
            </div>
            <div className="ldg-dial-gauge-lbl">냉방</div>
          </div>
        </div>

        <div className="ldg-proof">
          <div className={`ldg-proof-layer ${proof === 0 ? "active" : ""}`}>
            <div className="ldg-proof-text">바람만 나오고 시원하지 않아요</div>
          </div>
          <div className={`ldg-proof-layer ${proof === 1 ? "active" : ""}`}>
            <img src="/landing/assets/gauge_real.jpg" alt="현장 게이지 측정" />
            <div className="ldg-proof-badge">진단 중</div>
            <div className="ldg-proof-text on-photo">전문 게이지로 냉매 압력을 직접 측정합니다</div>
          </div>
          <div className={`ldg-proof-layer ${proof === 2 ? "active" : ""}`}>
            <img src="/landing/assets/charge_real.png" alt="냉매 충전 완료 + 21°C 확인" />
            <div className="ldg-proof-badge done">충전 완료</div>
            <div className="ldg-proof-text on-photo">정품 냉매 충전 · 적외선 온도계로 21°C 직접 확인</div>
          </div>
        </div>

        <div className="ldg-dial-steps">
          <div className={`ldg-dial-step ${step >= 1 ? "active" : ""}`}>
            <span className="ldg-dial-step-num">1</span>
            증상
          </div>
          <div className={`ldg-dial-step ${step >= 2 ? "active" : ""}`}>
            <span className="ldg-dial-step-num">2</span>
            측정·충전
          </div>
          <div className={`ldg-dial-step ${step >= 3 ? "active" : ""}`}>
            <span className="ldg-dial-step-num">3</span>
            완료
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. WHY (말풍선 타이핑)
// ============================================================
function useTypewriter(ref, fullText, stagger = 0) {
  const [show, setShow] = useState(fullText);
  const [typed, setTyped] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !typed) {
          setTyped(true);
          setTimeout(() => {
            setShow("");
            let i = 0;
            function nextChar() {
              i++;
              setShow(fullText.slice(0, i));
              if (i < fullText.length) {
                const ch = fullText[i];
                const delay = ch === "\n" ? 220 : 58 + Math.random() * 46;
                setTimeout(nextChar, delay);
              }
            }
            nextChar();
          }, stagger);
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 });
    io.observe(ref.current);
    // 2초 fallback
    const fb = setTimeout(() => {
      if (!typed) { setTyped(true); setShow(fullText); }
    }, 2000);
    return () => { io.disconnect(); clearTimeout(fb); };
  }, [ref, fullText, stagger, typed]);
  return show;
}

function Bubble({ text, stagger }) {
  const ref = useRef(null);
  const shown = useTypewriter(ref, text, stagger);
  return (
    <div ref={ref} className="ldg-bubble" aria-label={text}>
      <span>{shown}</span>
      <span className="ldg-bubble-caret" />
    </div>
  );
}

function Why() {
  return (
    <section className="ldg-section" id="02-cause">
      <div className="ldg-container">
        <span className="ldg-eyebrow">WHY</span>
        <h2 className="ldg-h2">{"안 시원한 데는\n이유가 있습니다"}</h2>
        <p className="ldg-lead">
          증상에 맞춰 원인을 짚어내고, 필요한 서비스로 바로 연결합니다.
        </p>

        <div className="ldg-why-grid">
          <article className="ldg-why-card hot">
            <Bubble text={"틀어도 바람만 나오고\n하나도 안 시원해요"} stagger={0} />
            <div className="ldg-cause-lbl">예상 원인</div>
            <h3 className="ldg-cause-name">냉매 부족</h3>
            <span className="ldg-cause-hint">가장 흔한 원인</span>
            <div>
              <span className="ldg-solve-badge filled">냉매충전으로 해결 →</span>
            </div>
          </article>

          <article className="ldg-why-card">
            <Bubble text={"에어컨에서 냄새 나고\n바람도 약해요"} stagger={320} />
            <div className="ldg-cause-lbl">예상 원인</div>
            <h3 className="ldg-cause-name">필터·송풍팬 오염</h3>
            <div>
              <span className="ldg-solve-badge outline">분해세척으로 해결 →</span>
            </div>
          </article>

          <article className="ldg-why-card">
            <Bubble text={"갑자기 에러 코드 뜨고\n에어컨이 꺼져요"} stagger={640} />
            <div className="ldg-cause-lbl">예상 원인</div>
            <h3 className="ldg-cause-name">부품 고장</h3>
            <div>
              <span className="ldg-solve-badge ghost">방문 진단으로 확인 →</span>
            </div>
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
        <div className="ldg-solution-head">
          <div>
            <span className="ldg-eyebrow">SOLUTION</span>
            <h2 className="ldg-h2">{"전문 기사가\n진단부터 해결까지"}</h2>
          </div>
          <span className="ldg-pill-info">전 브랜드 냉매충전 가능</span>
        </div>

        <div className="ldg-solution-grid">
          <article className="ldg-soln-card">
            <div className="ldg-soln-photo">
              <img src="/landing/assets/charge.jpg" alt="냉매충전 현장" />
              <div className="ldg-soln-photo-badge main">주력 서비스</div>
            </div>
            <div className="ldg-soln-body">
              <h3>냉매충전</h3>
              <p>현장에서 게이지로 잔량을 확인하고, 부족한 만큼만 정량 충전합니다. 누설이 의심되면 위치 찾기와 보수까지 함께 진행합니다.</p>
              <ul className="ldg-soln-list">
                <li>냉매 누수 점검 포함</li>
                <li>정품 냉매 사용 (R-22 · R-410A)</li>
                <li>당일 출장 가능</li>
              </ul>
            </div>
          </article>

          <article className="ldg-soln-card">
            <div className="ldg-soln-photo">
              <img src="/landing/assets/wash.jpg" alt="분해세척 현장" />
              <div className="ldg-soln-photo-badge dust">먼지·필터 청소</div>
            </div>
            <div className="ldg-soln-body">
              <h3>분해세척</h3>
              <p>전면 분해 후 필터·송풍팬·열교환기까지 안쪽 먼지와 곰팡이를 씻어냅니다. 분해 안 하는 표면 닦기와는 효과가 완전히 다릅니다.</p>
              <ul className="ldg-soln-list">
                <li>벽걸이·스탠드·시스템에어컨</li>
                <li>곰팡이·세균까지 제거</li>
                <li>당일 출장 가능</li>
              </ul>
            </div>
          </article>
        </div>

        <div className="ldg-soln-one">
          <WrenchIcon />
          <span>수리·설치도 가능합니다 — 방문 진단 후 안내해드립니다.</span>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 5. PRICE
// ============================================================
const WASH_ROWS = [
  { name: "벽걸이",            orig: 90000,  sale: 60000  },
  { name: "천장형 (1WAY)",     orig: 120000, sale: 90000  },
  { name: "스탠드",            orig: 160000, sale: 110000 },
  { name: "2 IN 1 (벽+스탠드)", orig: 195000, sale: 160000 },
  { name: "천장형 (4WAY)",     orig: 170000, sale: 140000 },
];
const CHARGE_ROWS = [
  { name: "벽걸이",        sale: 70000  },
  { name: "스탠드",        sale: 80000  },
  { name: "2 IN 1",        sale: 100000 },
  { name: "천장형 (1WAY)", sale: 90000  },
  { name: "천장형 (4WAY)", sale: "전화 상담" },
  { name: "누설 수리",     sale: "전화 상담" },
];

// 2026-06-23 — 사장님 spec: 가격표 모든 금액 "~" 표기 (확정가 오해 방지).
//   '전화 상담' 같은 string 은 그대로. number 만 시작가 표시.
function won(n, tilde = false) {
  if (typeof n === "string") return n;
  return n.toLocaleString("ko-KR") + "원" + (tilde ? "~" : "");
}

function Price({ onCtaForm }) {
  return (
    <section className="ldg-section" id="03b-price">
      <div className="ldg-container">
        <span className="ldg-eyebrow">PRICE</span>
        <h2 className="ldg-h2">비용, 미리 알려드립니다</h2>
        <p className="ldg-lead">
          현장에서 서비스 전 정확한 견적을 안내드리고, 동의하신 금액으로만 진행합니다.
        </p>

        <div className="ldg-price-grid">
          <div className="ldg-price-card">
            <h3>에어컨 분해세척</h3>
            <table className="ldg-price-table">
              <thead>
                <tr><th>기종</th><th>정상가</th><th>할인 시작가</th></tr>
              </thead>
              <tbody>
                {WASH_ROWS.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="orig">{won(r.orig)}</td>
                    <td className="sale">{won(r.sale, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="ldg-price-cta" onClick={onCtaForm}>
              지금 분해세척 접수하기 →
            </button>
          </div>

          <div className="ldg-price-card">
            <h3>냉매충전 (가스충전)</h3>
            <table className="ldg-price-table">
              <thead>
                <tr><th>기종</th><th>보충 시작가</th></tr>
              </thead>
              <tbody>
                {CHARGE_ROWS.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="sale">{won(r.sale, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ldg-price-note">+ 완충 시 30,000원 추가</div>
            <div className="ldg-price-warn">
              ※ 기계 고장·실외기 접근 불가로 충전 못할 경우 출장비 30,000원 발생
            </div>
          </div>
        </div>

        <p className="ldg-price-disclaimer">
          ※ 표시 금액은 <strong>시작가 기준</strong> — 현장 상태 / 추가 작업에 따라 변동 가능합니다.
          정확한 금액은 방문 진단 후 확정, 추가 비용은 사전 동의 후에만 청구합니다.
        </p>
      </div>
    </section>
  );
}

// ============================================================
// 6. EVIDENCE — Before/After Slider + 4단계 절차
// ============================================================
function BeforeAfterSlider() {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    // nudge — 로드 후 사인파로 50% 주변 한 번 흔들기
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
    const wrap = wrapRef.current;
    if (!wrap) return 50;
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX ?? 0) - rect.left;
    return clamp((x / rect.width) * 100);
  }
  function onPointerDown(e) {
    draggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    setPos(posFromEvent(e));
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    setPos(posFromEvent(e));
  }
  function onPointerUp(e) {
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  return (
    <div
      ref={wrapRef}
      className="ldg-evi-slider"
      style={{ "--ldg-pos": `${pos}%`, "--ldg-clip": `${100 - pos}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img className="ldg-evi-img after"  src="/landing/assets/after.jpg"  alt="세척 후" />
      <img className="ldg-evi-img before" src="/landing/assets/before.jpg" alt="세척 전" />
      <span className="ldg-evi-badge before">세척 전</span>
      <span className="ldg-evi-badge after">세척 후</span>
      <div className="ldg-evi-handle" aria-hidden="true" />
      <div className="ldg-evi-knob" aria-hidden="true">⟷</div>
    </div>
  );
}

const PROCESS_STEPS = [
  { tag: "STEP 1", title: "10초 접수",         body: "전화·온라인으로 연락처만 남기면 끝." },
  { tag: "STEP 2", title: "담당 기사 연락",    body: "담당 기사가 직접 연락드려 상담 후 방문 일정을 조율합니다." },
  { tag: "STEP 3", title: "방문 진단 · 견적",  body: "현장에서 상태를 확인하고 서비스 전 정확한 견적을 안내합니다." },
  { tag: "STEP 4", title: "작업 · 결과 확인",  body: "동의하신 금액으로 정품 자재 작업 후 결과를 함께 확인합니다." },
];

function Evidence() {
  return (
    <section className="ldg-section" id="04-evidence">
      <div className="ldg-container">
        <span className="ldg-eyebrow">BEFORE / AFTER</span>
        <h2 className="ldg-h2">{"말 대신\n보여드립니다"}</h2>
        <p className="ldg-lead">
          분해세척 전후 비교입니다. 손잡이를 좌우로 끌어보세요.
        </p>

        <BeforeAfterSlider />
        <p className="ldg-evi-cap">손잡이를 끌어 세척 전 ↔ 세척 후를 직접 비교 · 열교환기 핀 클로즈업</p>

        <div className="ldg-steps-grid">
          {PROCESS_STEPS.map((s, i) => (
            <div key={i} className="ldg-step-card">
              <div className="ldg-step-num">{i + 1}</div>
              <span className="ldg-step-tag">{s.tag}</span>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 7. Bridge (그라데이션)
// ============================================================
function Bridge() {
  return <div className="ldg-bridge" aria-hidden="true" />;
}

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

function StatNum({ target, suffix }) {
  const ref = useRef(null);
  const v = useCountUp(ref, target);
  return (
    <div ref={ref} className="ldg-stat-num">
      {v.toLocaleString("ko-KR")}{suffix}
    </div>
  );
}

const REVIEWS = [
  {
    text: "당일 바로 방문해서 1시간도 안 걸려 끝났어요. 기사님이 게이지로 직접 보여주셔서 신뢰가 갔습니다.",
    name: "김*진",
    detail: "냉매충전 · 서울 마포구",
  },
  {
    text: "안에 곰팡이가 이렇게 많은지 몰랐어요. 분해세척 후 바람이 시원하게 나옵니다.",
    name: "이*현",
    detail: "분해세척 · 경기 성남시",
  },
  {
    text: "바람은 나오는데 안 시원해 바로 전화드렸더니, 그날 바로 오셔서 저를 살려주셨네요. 감사합니다.",
    name: "박*수",
    detail: "냉매충전 · 서울 강서구",
  },
];

function Trust({ formNode }) {
  return (
    <section className="ldg-trust" id="05-reassurance">
      <div className="ldg-container">
        <div className="ldg-stats">
          <div>
            <div className="ldg-stat-icon">
              <ClipboardIcon />
            </div>
            <StatNum target={5000} suffix="+" />
            <div className="ldg-stat-lbl">누적 작업 건수</div>
          </div>
          <div>
            <div className="ldg-stat-icon">
              <UserIcon />
            </div>
            <StatNum target={30} suffix="+" />
            <div className="ldg-stat-lbl">전문 기사</div>
          </div>
          <div>
            <div className="ldg-stat-icon">
              <CalendarIcon />
            </div>
            <StatNum target={365} suffix="" />
            <div className="ldg-stat-lbl">연중무휴 케어</div>
          </div>
        </div>

        <h3>실제 이용 후기</h3>
        <div className="ldg-reviews-grid">
          {REVIEWS.map((r, i) => (
            <div className="ldg-review-card" key={i}>
              <div className="ldg-review-stars">★★★★★</div>
              <p className="ldg-review-text">“{r.text}”</p>
              <div className="ldg-review-meta">{r.name} · {r.detail}</div>
            </div>
          ))}
        </div>

        {formNode}
      </div>
    </section>
  );
}

// ============================================================
// 9. FORM
// ============================================================
function CtaForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    service: "분해세척",
    name: "",
    phone: "",
    address: "",
    consent: false,
  });
  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.consent) {
      alert("개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    // 백엔드 미연결 — 완료 상태 화면 표시 (디자인 검증 단계)
    setSubmitted(true);
  }

  return (
    <div className="ldg-form-card" id="form">
      {submitted ? (
        <div className="ldg-form-done">
          <div className="ldg-form-done-ico">
            <CheckIcon />
          </div>
          <h3>접수 완료</h3>
          <p>
            남겨주신 연락처로 곧 안내 전화드리겠습니다.<br/>
            영업시간 외에는 다음 영업일 오전에 연락드립니다.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h3>접수하기</h3>

          <div className="ldg-form-field">
            <label htmlFor="ldg-service">서비스</label>
            <select id="ldg-service" value={form.service} onChange={(e) => set("service", e.target.value)}>
              <option>분해세척</option>
              <option>냉매충전</option>
              <option>수리 / 설치</option>
              <option>기타 / 문의</option>
            </select>
          </div>

          <div className="ldg-form-field">
            <label htmlFor="ldg-name">이름</label>
            <input id="ldg-name" type="text" placeholder="홍길동"
                   value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="ldg-form-field">
            <label htmlFor="ldg-phone">연락처</label>
            <input id="ldg-phone" type="tel" placeholder="010-1234-5678"
                   value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
          </div>

          <div className="ldg-form-field">
            <label htmlFor="ldg-addr">주소</label>
            <input id="ldg-addr" type="text" placeholder="서울시 강서구 OO로 OO"
                   value={form.address} onChange={(e) => set("address", e.target.value)} required />
          </div>

          <label className="ldg-form-consent">
            <input type="checkbox" checked={form.consent}
                   onChange={(e) => set("consent", e.target.checked)} />
            <span>개인정보 수집·이용에 동의합니다. (이름 / 연락처 / 주소 — 출장 안내 목적, 관련 법령에 따라 보관 후 파기)</span>
          </label>

          <button type="submit" className="ldg-form-submit">접수 신청</button>
        </form>
      )}
    </div>
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
        <dl>
          <dt>대표자</dt><dd>조동욱, 구현서</dd>
          <dt>사업자번호</dt><dd>430-07-03167</dd>
          <dt>상호</dt><dd>에어컨청소 에어컨가스충전 올데이케어</dd>
          <dt>주소</dt><dd>경기도 고양시 덕양구 상막3길 5, 1동 805호</dd>
          <dt>대표전화</dt><dd>{PHONE_DISPLAY}</dd>
          <dt>서비스 지역</dt><dd>서울·경기 전 지역 당일 출장</dd>
        </dl>
        <div className="ldg-footer-divider" />
        <div className="ldg-footer-copyr">© 2026 올데이케어. All rights reserved.</div>
      </div>
    </footer>
  );
}

// ============================================================
// 11. Sticky Bar
// ============================================================
function StickyBar({ onCtaForm }) {
  return (
    <nav className="ldg-sticky" aria-label="빠른 행동">
      <a className="phone" href={PHONE_TEL}>
        <PhoneIcon size={16} /> 전화 연결
      </a>
      <button className="submit" onClick={onCtaForm}>
        접수하기
      </button>
    </nav>
  );
}

// ============================================================
// Icons (인라인 SVG)
// ============================================================
function PhoneIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

// ============================================================
// LandingApp 루트
// ============================================================
export default function LandingApp() {
  function scrollToForm() {
    const el = document.getElementById("form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 스무스 스크롤 전역 활성화
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  return (
    <div className="ldg-root" id="top">
      <Ticker />
      <Header />
      <Hero onCtaForm={scrollToForm} />
      <Why />
      <Solution />
      <Price onCtaForm={scrollToForm} />
      <Evidence />
      <Bridge />
      <Trust formNode={<CtaForm />} />
      <Footer />
      <StickyBar onCtaForm={scrollToForm} />
    </div>
  );
}
