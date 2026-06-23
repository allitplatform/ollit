// 올데이케어 마케팅 랜딩 + 셀프 접수 폼 (2026-06-23, v3).
//   · v3: 실 현장 사진 매핑 + 콘텐츠 확장 (공유.html 스토리텔링).
//   · 1차: UI + 폼 디자인. 백엔드 (inquiries / RPC / 해피콜 인박스) 미연결 — Phase 2.
//   · 도메인: alldaycare.kr(예정) 또는 ?page=landing 시 App.jsx 가 본 컴포넌트 렌더.
//   · 사진: public/landing/photos/ — hero / field-refri / disassemble / gauge-close 등.

import { useMemo, useState } from "react";
import {
  Phone, ChevronRight, ArrowRight, Thermometer, Filter, Wrench,
  ShieldCheck, Calendar, MessageSquare, Sparkles, CheckCircle2,
  Clock, MapPin, User, Award, PackageCheck,
  Scissors, Droplets, Sprout, ClipboardCheck
} from "lucide-react";
import "../styles/landing.css";

const PHONE_DISPLAY = "1866-2003";
const PHONE_TEL     = "tel:18662003";

const HEADLINE_LINES = [
  "또 여름인데,",
  "작년처럼 안 시원하면?",
  "원인부터 정확히.",
];

export default function LandingApp() {
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }

  function scrollToForm() {
    const el = document.getElementById("ldg-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="ldg-root">
      <Hero onCta={scrollToForm} />
      <Why />
      <Solution />
      <Process />
      <WhyUs />
      <Evidence />
      <Trust />
      <CtaForm onSubmit={() => showToast("접수 디자인 검증 단계 — 백엔드 미연결")} />
      <Footer />
      <StickyBar onCta={scrollToForm} />
      {toast && <div className="ldg-toast">{toast}</div>}
    </div>
  );
}

// ============================================================
// Hero — 좌 헤드라인 3줄 + 게이지 진단 / 우 시원한 바람 사진
// ============================================================
function Hero({ onCta }) {
  let charIdx = 0;
  return (
    <section className="ldg-hero">
      <div className="ldg-container ldg-hero-grid">
        <div>
          <div className="ldg-hero-brand">
            <Sparkles size={14} />
            올데이케어 · 에어컨 종합 케어
          </div>

          <h1 className="ldg-hero-headline">
            {HEADLINE_LINES.map((line, li) => (
              <span className="ldg-hero-line" key={li}>
                {line.split("").map((ch, ci) => {
                  const delay = (charIdx++) * 0.04;
                  return (
                    <span key={ci} className="ldg-w" style={{ animationDelay: `${delay}s` }}>
                      {ch === " " ? " " : ch}
                    </span>
                  );
                })}
              </span>
            ))}
          </h1>

          <p className="ldg-hero-sub">
            냉매가 줄어 시원하지 않은 건지, 필터 안쪽이 막힌 건지 — 추측하지 않습니다.
            <br/>현장에서 <strong>게이지로 직접 확인</strong>해 원인을 짚어내고, 부족한 만큼만 정량 충전 / 분해세척까지 한 번에.
          </p>

          <div className="ldg-hero-meta">
            <span><MapPin size={13}/> 서울·경기 전 지역 당일 출장</span>
            <span><Clock size={13}/> 365일 연중무휴</span>
          </div>

          <div className="ldg-hero-cta">
            <button className="ldg-btn ldg-btn-primary" onClick={onCta}>
              지금 접수하기 <ArrowRight size={16} />
            </button>
            <a className="ldg-btn ldg-btn-outline" href={PHONE_TEL}>
              <Phone size={16} /> {PHONE_DISPLAY}
            </a>
          </div>

          <DiagnosisGauge />
        </div>

        <div className="ldg-hero-image">
          <img src="/landing/photos/hero.png" alt="시원한 바람이 나오는 에어컨" />
        </div>
      </div>
    </section>
  );
}

function DiagnosisGauge() {
  return (
    <div className="ldg-gauge-card">
      <svg viewBox="0 0 220 150" className="ldg-gauge-svg" aria-hidden="true">
        <defs>
          <linearGradient id="ldgGaugeBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0"   stopColor="#FEE2E2"/>
            <stop offset="0.5" stopColor="#FEF3C7"/>
            <stop offset="1"   stopColor="#D1FAE5"/>
          </linearGradient>
        </defs>
        <path d="M 20 125 A 90 90 0 0 1 200 125"
              stroke="url(#ldgGaugeBg)" strokeWidth="22"
              fill="none" strokeLinecap="round"/>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const a = Math.PI * (1 - t);
          const x1 = 110 + Math.cos(a) * 72;
          const y1 = 125 - Math.sin(a) * 72;
          const x2 = 110 + Math.cos(a) * 86;
          const y2 = 125 - Math.sin(a) * 86;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                       stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>;
        })}
        <text x="22"  y="143" fontSize="11" fontWeight="700" fill="#DC2626">부족</text>
        <text x="198" y="143" fontSize="11" fontWeight="700" fill="#10B981" textAnchor="end">정상</text>
        <g className="ldg-gauge-needle">
          <line x1="110" y1="125" x2="110" y2="48" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="110" cy="125" r="7" fill="#0F172A"/>
          <circle cx="110" cy="125" r="3" fill="#FFFFFF"/>
        </g>
      </svg>
      <div className="ldg-gauge-overlay">
        <div className="ldg-gauge-status">
          <span className="bad">냉매 부족</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span className="good">정상 회복</span>
        </div>
        <p>현장에서 게이지로 직접 확인 → 부족한 만큼 정량 충전</p>
      </div>
    </div>
  );
}

// ============================================================
// Why — 원인 (3가지) — 풍부한 설명
// ============================================================
function Why() {
  const items = [
    {
      icon: <Thermometer size={22} />,
      title: "냉매가 부족해서",
      body: "에어컨은 닫힌 시스템이지만, 미세한 누설로 냉매가 조금씩 빠집니다. 가스가 부족하면 송풍은 되지만 차가워지지 않습니다.",
      tag:  "가장 흔한 원인",
    },
    {
      icon: <Filter size={22} />,
      title: "필터·송풍팬이 막혀서",
      body: "필터 / 송풍팬 / 열교환기 안쪽에 먼지와 곰팡이가 쌓이면 바람 양이 줄고 곰팡이 냄새가 납니다. 같은 전기로 효율이 30%까지 떨어집니다.",
      tag:  "냄새·바람 양 문제",
    },
    {
      icon: <Wrench size={22} />,
      title: "부품이 고장 났을 때",
      body: "콘덴서·실외기 팬 등 핵심 부품이 노후되면 작동이 일정 시간 후 멈춥니다. 조기 점검이 큰 비용을 줄입니다.",
      tag:  "수리 영역",
    },
  ];

  return (
    <section className="ldg-section ldg-why">
      <div className="ldg-container">
        <span className="ldg-section-tag">WHY</span>
        <h2 className="ldg-section-title">왜 시원하지 않을까요?</h2>
        <p className="ldg-section-lead">
          시원하지 않은 에어컨에는 보통 세 가지 원인이 있습니다.
          원인을 알면 해결도 빠릅니다.
        </p>

        <div className="ldg-why-list">
          {items.map((it, i) => (
            <div className="ldg-why-card" key={i}>
              <div className="ldg-why-card-icon">{it.icon}</div>
              <div>
                <span className="ldg-why-card-tag">{it.tag}</span>
                <h4>{it.title}</h4>
                <p>{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Solution — 냉매충전 + 분해세척 (실제 현장 사진)
// ============================================================
function Solution() {
  return (
    <section className="ldg-section">
      <div className="ldg-container">
        <span className="ldg-section-tag">SOLUTION</span>
        <h2 className="ldg-section-title">두 가지 핵심 케어</h2>
        <p className="ldg-section-lead">
          가장 많이 필요한 두 가지를 잘 하는 데 집중합니다.
          상황에 따라 수리도 함께 안내드립니다.
        </p>

        <div className="ldg-solution-list">
          <article className="ldg-solution-card main">
            <div className="ldg-solution-photo">
              <img src="/landing/photos/field-refri.jpg" alt="실외기 게이지 점검 + 정량 충전 현장" />
              <div className="ldg-solution-photo-tag">현장 게이지 + 정량 충전</div>
            </div>
            <div className="ldg-solution-body">
              <span className="badge">CORE</span>
              <h4>냉매충전</h4>
              <p>
                실외기에 게이지 매니폴드를 연결해 잔량을 직접 확인합니다.
                부족한 만큼만 정량 충전하고, 누설이 의심되면 위치 찾기와 보수까지 같이 진행합니다.
              </p>
              <ul className="points">
                <li>잔량 확인</li>
                <li>정량 충전</li>
                <li>누설 점검</li>
                <li>R-22 / R-410A</li>
              </ul>
            </div>
          </article>

          <article className="ldg-solution-card main">
            <div className="ldg-solution-photo">
              <img src="/landing/photos/disassemble-2.jpg" alt="천장형 에어컨 분해 작업" />
              <div className="ldg-solution-photo-tag">전면 분해 + 안쪽까지 세척</div>
            </div>
            <div className="ldg-solution-body">
              <span className="badge">CORE</span>
              <h4>분해세척</h4>
              <p>
                전면 커버 / 필터 / 송풍팬 / 열교환기까지 분해해 안쪽에 쌓인 먼지와 곰팡이를
                씻어냅니다. 분해 X 표면 닦기와는 효과가 완전히 다릅니다.
              </p>
              <ul className="points">
                <li>전면 분해</li>
                <li>송풍팬 세척</li>
                <li>친환경 약품</li>
                <li>벽걸이 / 스탠드 / 천장형</li>
              </ul>
            </div>
          </article>
        </div>

        <div className="ldg-solution-mini">
          <Wrench size={16} />
          <span>부품 고장이 의심되면 — 점검 후 수리 견적까지 함께 안내드립니다.</span>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Process — 분해세척 4단계 (사진 포함)
// ============================================================
function Process() {
  const steps = [
    {
      icon: <Scissors size={20}/>,
      title: "분해",
      body: "전면 커버 / 필터 / 송풍팬 / 열교환기를 안전하게 분해합니다. 표면 세척과 달리 안쪽까지 손이 닿는 유일한 방법입니다.",
      photo: "/landing/photos/disassemble-1.jpg",
      alt: "에어컨 전면 분해 작업",
    },
    {
      icon: <Droplets size={20}/>,
      title: "고압세척",
      body: "안쪽 열교환기와 송풍팬에 쌓인 먼지·곰팡이를 고압수로 씻어냅니다. 검은 물이 그대로 나옵니다.",
      photo: "/landing/photos/before-1.jpg",
      alt: "고압세척 직전 오염된 열교환기",
    },
    {
      icon: <Sprout size={20}/>,
      title: "항균",
      body: "세척 후 친환경 항균 약품을 코팅합니다. 곰팡이 재발 시기를 늦춥니다.",
      photo: null,
      alt: "",
    },
    {
      icon: <ClipboardCheck size={20}/>,
      title: "점검",
      body: "조립 후 바람 양 / 소음 / 토출 온도 / 누수 여부까지 정상 작동을 확인합니다.",
      photo: "/landing/photos/gauge-close.jpg",
      alt: "게이지로 마무리 점검",
    },
  ];

  return (
    <section className="ldg-section ldg-process">
      <div className="ldg-container">
        <span className="ldg-section-tag">PROCESS</span>
        <h2 className="ldg-section-title">분해세척, 이렇게 합니다</h2>
        <p className="ldg-section-lead">
          현장에서 모든 과정을 직접 보여드립니다.
          작업 중 사진은 원하시면 작업 후에 보내드립니다.
        </p>

        <ol className="ldg-process-list">
          {steps.map((s, i) => (
            <li key={i} className="ldg-process-step">
              <div className="ldg-process-head">
                <div className="ldg-process-num">{i + 1}</div>
                <div className="ldg-process-icon">{s.icon}</div>
              </div>
              {s.photo ? (
                <div className="ldg-process-photo">
                  <img src={s.photo} alt={s.alt} />
                </div>
              ) : (
                <div className="ldg-process-photo-empty">
                  <Sprout size={36} strokeWidth={1.5} />
                </div>
              )}
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ============================================================
// WhyUs — 왜 올데이케어 (3카드, 사진 1장 추가)
// ============================================================
function WhyUs() {
  const items = [
    {
      icon: <Award size={24}/>,
      title: "경력 검증된 기사",
      body: "현장 경험을 가진 검증된 기사가 직접 출장합니다. 누가 와도 같은 품질을 유지하기 위해 작업 단계를 표준화했습니다.",
    },
    {
      icon: <PackageCheck size={24}/>,
      title: "정품 자재 / 정량 충전",
      body: "냉매(R-22 / R-410A)와 세척 약품은 정품만 사용합니다. 게이지로 정량을 직접 확인해 \"넉넉히\" 가 아닌 \"정확히\" 충전합니다.",
    },
    {
      icon: <ShieldCheck size={24}/>,
      title: "작업 보증",
      body: "작업 후 일정 기간 내 동일 증상이 재발하면 무상 재점검으로 책임집니다. 보증 내용은 작업 전 안내드립니다.",
    },
  ];

  return (
    <section className="ldg-section ldg-whyus">
      <div className="ldg-container">
        <span className="ldg-section-tag">WHY US</span>
        <h2 className="ldg-section-title">왜 올데이케어인가</h2>
        <p className="ldg-section-lead">
          경력 / 정품 / 보증 — 세 가지로 정리됩니다.
        </p>

        <div className="ldg-whyus-list">
          {items.map((it, i) => (
            <div key={i} className="ldg-whyus-card">
              <div className="ldg-whyus-icon">{it.icon}</div>
              <h4>{it.title}</h4>
              <p>{it.body}</p>
            </div>
          ))}
        </div>

        <div className="ldg-whyus-photo">
          <img src="/landing/photos/field-leak-check.jpg" alt="현장 누설 검사 + 진공 펌프 + 게이지" />
          <div className="ldg-whyus-photo-cap">
            현장에서 게이지·진공 펌프·누설 검사기를 모두 가지고 갑니다. 상황에 맞게 사용합니다.
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Evidence — 증거 (전/후 슬라이더)
// ============================================================
function Evidence() {
  const [pos, setPos] = useState(50);

  return (
    <section className="ldg-section ldg-evidence">
      <div className="ldg-container">
        <span className="ldg-section-tag">EVIDENCE</span>
        <h2 className="ldg-section-title">말 대신 보여드립니다</h2>
        <p className="ldg-section-lead">
          실제 분해세척 전후 비교입니다. 핸들을 좌우로 옮겨보세요.
          오염은 외관이 아닌 안쪽 열교환기에 쌓입니다.
        </p>

        <div className="ldg-evidence-slider" style={{ "--ldg-slider-pos": `${pos}%` }}>
          <div className="ldg-evidence-slider-wrap">
            <img src="/landing/photos/before-1.jpg" alt="분해세척 전" className="before" />
            <img src="/landing/photos/after-1.jpg"  alt="분해세척 후" className="after" />
            <div className="ldg-evidence-slider-handle" aria-hidden="true" />
            <input
              type="range" min="0" max="100" value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              aria-label="전/후 슬라이더"
            />
          </div>
          <div className="ldg-evidence-labels">
            <span className="before-l">BEFORE</span>
            <span className="after-l">AFTER</span>
          </div>
        </div>
        <p className="ldg-evidence-caption">실제 현장 작업 사진 · 고객 동의 후 사용</p>
      </div>
    </section>
  );
}

// ============================================================
// Trust — 안심 (통계 + 후기)
// ============================================================
function Trust() {
  const reviews = [
    {
      quote: "여름 시작 전에 받았는데, 바람이 차게 나옵니다. 기사님이 게이지로 직접 보여줘서 신뢰가 갔어요.",
      meta:  "K님 · 강서구 · 냉매충전",
    },
    {
      quote: "10년 된 에어컨인데 분해세척 후 바람 양이 확실히 늘었습니다. 곰팡이 냄새도 사라졌어요.",
      meta:  "J님 · 분당구 · 분해세척",
    },
    {
      quote: "전화 한 통으로 당일 출장 받았습니다. 시간 약속이 정확해서 좋았어요.",
      meta:  "L님 · 일산 · 냉매충전",
    },
  ];

  return (
    <section className="ldg-section ldg-trust">
      <div className="ldg-container">
        <span className="ldg-section-tag">TRUST</span>
        <h2 className="ldg-section-title">기록과 후기</h2>
        <p className="ldg-section-lead">
          숫자와 실제 사용자 말씀으로 보여드립니다.
        </p>

        <div className="ldg-trust-stats">
          <div>
            <strong>5,000+</strong>
            <span>누적 작업</span>
          </div>
          <div>
            <strong>30명</strong>
            <span>전문 기사</span>
          </div>
          <div>
            <strong>365일</strong>
            <span>연중무휴</span>
          </div>
        </div>

        <div className="ldg-trust-reviews">
          {reviews.map((r, i) => (
            <div className="ldg-review" key={i}>
              <p className="ldg-review-quote">“{r.quote}”</p>
              <div className="ldg-review-meta">{r.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CtaForm — 행동 (셀프 접수 폼 / UI 만, 백엔드 미연결)
// ============================================================
const SERVICES = [
  { key: "cleaning",    label: "분해세척" },
  { key: "refrigerant", label: "냉매충전" },
  { key: "repair",      label: "수리" },
];

function CtaForm({ onSubmit }) {
  const [form, setForm] = useState({
    service:  "cleaning",
    name:     "",
    phone:    "",
    address:  "",
    model:    "",
    qty:      "1",
    wishDate: "",
    wishTime: "",
    note:     "",
    privacy:  false,
  });

  const canSubmit = useMemo(() => {
    return form.name.trim() && form.phone.trim() && form.address.trim() && form.privacy;
  }, [form]);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    if (typeof onSubmit === "function") onSubmit(form);
  }

  return (
    <section className="ldg-section ldg-cta" id="ldg-form">
      <div className="ldg-container">
        <span className="ldg-section-tag">ACTION</span>
        <h2 className="ldg-section-title">접수하기</h2>
        <p className="ldg-section-lead">
          폼을 남기면 1866-2003 으로 안내 전화드립니다.
          영업시간 외 접수는 다음 영업일 오전에 연락드립니다.
        </p>

        <form className="ldg-cta-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>서비스 종류 <span className="req">*</span></label>
            <div className="ldg-cta-service">
              {SERVICES.map(s => (
                <label
                  key={s.key}
                  className={form.service === s.key ? "active" : ""}
                >
                  <input
                    type="radio" name="service" value={s.key}
                    checked={form.service === s.key}
                    onChange={() => set("service", s.key)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="row cols2">
            <div className="field">
              <label htmlFor="ldg-name"><User size={11} style={{ marginRight: 4, verticalAlign: -1 }} />이름 <span className="req">*</span></label>
              <input
                id="ldg-name" type="text" placeholder="홍길동"
                value={form.name} onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ldg-phone"><Phone size={11} style={{ marginRight: 4, verticalAlign: -1 }} />연락처 <span className="req">*</span></label>
              <input
                id="ldg-phone" type="tel" placeholder="010-1234-5678"
                value={form.phone} onChange={(e) => set("phone", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ldg-addr"><MapPin size={11} style={{ marginRight: 4, verticalAlign: -1 }} />주소 <span className="req">*</span></label>
            <input
              id="ldg-addr" type="text" placeholder="서울시 강서구 OO로 OO"
              value={form.address} onChange={(e) => set("address", e.target.value)}
              required
            />
          </div>

          <div className="row cols2">
            <div className="field">
              <label htmlFor="ldg-model">기종 (선택)</label>
              <input
                id="ldg-model" type="text" placeholder="벽걸이 / 스탠드 등"
                value={form.model} onChange={(e) => set("model", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ldg-qty">수량</label>
              <select id="ldg-qty" value={form.qty} onChange={(e) => set("qty", e.target.value)}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}대</option>)}
                <option value="6+">6대 이상</option>
              </select>
            </div>
          </div>

          <div className="row cols2">
            <div className="field">
              <label htmlFor="ldg-date"><Calendar size={11} style={{ marginRight: 4, verticalAlign: -1 }} />희망 날짜</label>
              <input
                id="ldg-date" type="date"
                value={form.wishDate} onChange={(e) => set("wishDate", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ldg-time"><Clock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />희망 시간대</label>
              <select id="ldg-time" value={form.wishTime} onChange={(e) => set("wishTime", e.target.value)}>
                <option value="">선택 안 함</option>
                <option value="09-12">오전 (09~12시)</option>
                <option value="12-15">점심 (12~15시)</option>
                <option value="15-18">오후 (15~18시)</option>
                <option value="18-21">저녁 (18~21시)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="ldg-note"><MessageSquare size={11} style={{ marginRight: 4, verticalAlign: -1 }} />요청사항 (선택)</label>
            <textarea
              id="ldg-note" rows={3}
              placeholder="문의 / 증상 / 추가 안내 사항을 자유롭게 적어주세요."
              value={form.note} onChange={(e) => set("note", e.target.value)}
            />
          </div>

          <label className="ldg-cta-privacy">
            <input
              type="checkbox"
              checked={form.privacy}
              onChange={(e) => set("privacy", e.target.checked)}
            />
            <span>
              개인정보 수집·이용에 동의합니다. (이름 / 연락처 / 주소 — 출장 안내 목적, 관련 법령에 따라 보관 후 파기) <a href="#privacy" onClick={(e) => e.preventDefault()}>전문 보기</a>
            </span>
          </label>

          <button className="ldg-cta-submit" type="submit" disabled={!canSubmit}>
            <CheckCircle2 size={18} style={{ marginRight: 6, verticalAlign: -3 }} />
            접수 신청
          </button>
        </form>
      </div>
    </section>
  );
}

// ============================================================
// Footer — 사업자 정보 (핸드오프 §8)
// ============================================================
function Footer() {
  return (
    <footer className="ldg-footer">
      <div className="ldg-container">
        <h5>에어컨청소 에어컨가스충전 올데이케어</h5>
        <dl>
          <dt>대표자</dt><dd>조동욱, 구현서</dd>
          <dt>사업자번호</dt><dd>430-07-03167</dd>
          <dt>주소</dt><dd>경기도 고양시 덕양구 상막3길 5, 1동 805호</dd>
          <dt>대표전화</dt><dd>{PHONE_DISPLAY}</dd>
          <dt>서비스 지역</dt><dd>서울·경기 전 지역 당일 출장</dd>
        </dl>
        <div className="divider" />
        <div className="small">© 2026 올데이케어. All rights reserved.</div>
      </div>
    </footer>
  );
}

// ============================================================
// Sticky Bar — 하단 고정 (전화 + 접수)
// ============================================================
function StickyBar({ onCta }) {
  return (
    <nav className="ldg-sticky" aria-label="빠른 행동">
      <a className="ldg-btn ldg-btn-outline" href={PHONE_TEL}>
        <Phone size={16} /> 전화 {PHONE_DISPLAY}
      </a>
      <button className="ldg-btn ldg-btn-primary" onClick={onCta}>
        접수하기 <ChevronRight size={16} />
      </button>
    </nav>
  );
}
