// 2026-06-19 Step 2 — 서류 발행 화면 (즉석, 작업목록 무관).
//
// 진입점: AdminApp 개요 탭 → setScreen("docIssue").
// 범위 (Step 2): 화면 + 파싱 + 발행처 사업자 정보 연동.
//   PDF 생성·카톡 공유·이력은 Step 3·4 (현재 버튼은 안내 alert).
//
// 권한: actor = 운영자 user_id. 발행처(기사) 사업자 정보는
//       get_engineer_business_info(p_user_id, p_actor) — 운영자 admin 통과.
//
// 어근 금지 정책 통과 (CLAUDE.md): 모든 사용자 노출 문자열 자연 한국어.

import { useEffect, useMemo, useState } from "react";
import { useIsDark } from "../../hooks/useIsDark.js";
import { supabase } from "../../lib/supabase.js";
import { getEngineerBusinessInfo } from "../../lib/engineerBusinessInfoDb.js";
import { issueDocument } from "../../lib/docIssuesDb.js";
import { parseDocIssuePaste, computeVatBreakdown } from "../../lib/docIssueParser.js";
import { formatPhone } from "../../utils/receptionForm.js";
import "./DocIssueScreen.css";

// 2026-07-10 — docIssueRender 청크 로드 헬퍼.
//   dynamic import 실패 (배포 후 옛 hash 참조 등) 시 사용자 안내 + 자동 리로드 트리거.
//   전역 unhandledrejection handler (main.jsx) 가 최종 catch 하지만 여기서
//   명시적으로 잡아 사용자 alert 후 reload 진행 → UX 개선.
async function _importDocIssueRender() {
  try {
    return await import("../../lib/docIssueRender.js");
  } catch (err) {
    const msg = String(err?.message || err || "");
    const isChunkFail = /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg);
    if (isChunkFail) {
      console.warn("[DocIssueScreen] docIssueRender chunk load fail — reloading", err);
      try { alert("새 버전이 배포됐습니다. 페이지를 새로고침합니다."); } catch {}
      try {
        const KEY = "__chunk_reload_at__";
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {}
    }
    throw err;
  }
}

// ──────────────────────────────────────────────
// 모듈 최상위 — 부모 리렌더에 input remount 안 일으키도록 분리.
//   (직전 EngineerBusinessInfoCard 포커스 손실 교훈 — 본문 안 정의 금지.)
// ──────────────────────────────────────────────
// 2026-06-19 — 컴팩트화 1pass. 카드 패딩 16→12, marginBottom 12→8.
//   터치 타겟(토글·버튼)은 minHeight 44 별도 보장.
function Section({ title, hint, isDark, children }) {
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: hint ? 2 : 7,
        letterSpacing: "-0.1px",
      }}>
        {title}
      </div>
      {hint && (
        <div style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginBottom: 7,
          lineHeight: 1.4,
        }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function TwoToggle({ value, options, onChange, isDark }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map(opt => {
        const on = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            style={{
              flex: 1,
              minHeight: 44,           // 모바일 터치 타겟 보장 (사장님 spec)
              padding: "9px 10px",
              borderRadius: 9,
              border: `1px solid ${on ? "#FF1B8D" : "var(--border)"}`,
              background: on
                ? (isDark ? "#2D0F1E" : "#FFE5F2")
                : "var(--bg-secondary)",
              color: on
                ? (isDark ? "#FF4DA6" : "#FF1B8D")
                : "var(--text-primary)",
              fontSize: 13,
              fontWeight: on ? 700 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, mono, type = "text", inputMode, className }) {
  // 2026-06-19 — date input 정렬 정정: 일반 text input 과 동일한 minHeight 36 명시.
  //   date 위젯은 OS 기본 line-height 가 더 커서 같은 padding 이어도 결과 키가 다름 →
  //   minHeight 로 명시적 일치. CSS 의사요소 (DocIssueScreen.css) 와 함께 작동.
  const isDate = type === "date";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 2,
      }}>{label}</div>
      <input
        type={type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        style={{
          width: "100%",
          minHeight: 36,
          padding: "8px 10px",
          fontSize: 13,
          fontFamily: mono ? "monospace" : "inherit",
          letterSpacing: mono ? 0.4 : 0,
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          outline: "none",
          boxSizing: "border-box",
          textAlign: "left",
          lineHeight: isDate ? 1.2 : undefined,
        }}
      />
    </div>
  );
}

// 2026-06-19 — 품목 구조: 대표 라벨(1줄, 총액) + 세부 라벨 배열(들여쓰기, 금액 X).
//   양식(InvoiceTemplate/ReceiptTemplate)은 이미 subItems 들여쓰기 처리 지원.
//   본 ItemChip 은 대표 행 + 세부 라벨 inline 편집 UI 제공.
const subInputStyle = {
  flex: 1, minWidth: 0,
  padding: "4px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-primary)",
  color: "var(--text-secondary)",
  fontSize: 12, fontFamily: "inherit",
  outline: "none",
};

function ItemChip({ item, idx, onChange, onRemove }) {
  const subItems = Array.isArray(item.subItems) ? item.subItems : [];

  function setSub(subIdx, value) {
    const next = subItems.slice();
    next[subIdx] = value;
    onChange(idx, { ...item, subItems: next });
  }
  function addSub() {
    onChange(idx, { ...item, subItems: subItems.concat([""]) });
  }
  function removeSub(subIdx) {
    const next = subItems.filter((_, i) => i !== subIdx);
    onChange(idx, { ...item, subItems: next });
  }

  return (
    <div style={{
      padding: "7px 8px 6px",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      marginBottom: 6,
    }}>
      {/* 대표 행 — 라벨 / 수량 / 총액 / 삭제 */}
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <input
          value={item.label}
          onChange={e => onChange(idx, { ...item, label: e.target.value })}
          placeholder="대표 품목 (예: 에어컨 누설 수리 작업 일체)"
          style={{
            flex: 2, minWidth: 0,
            padding: "5px 8px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: 13, fontFamily: "inherit",
            outline: "none",
          }}
        />
        <input
          type="text"
          inputMode="numeric"
          value={item.qty ?? 1}
          onChange={e => onChange(idx, { ...item, qty: Number(e.target.value.replace(/\D/g, "")) || 1 })}
          aria-label="수량"
          style={{
            width: 44,
            padding: "5px 6px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: 13, fontFamily: "monospace",
            textAlign: "center",
            outline: "none",
          }}
        />
        <input
          type="text"
          inputMode="numeric"
          value={item.price != null ? Number(item.price).toLocaleString("ko-KR") : ""}
          onChange={e => {
            const n = Number(String(e.target.value).replace(/\D/g, "")) || 0;
            onChange(idx, { ...item, price: n || undefined });
          }}
          placeholder="총액"
          aria-label="총액"
          style={{
            flex: 1, minWidth: 80,
            padding: "5px 8px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: 13, fontFamily: "monospace",
            textAlign: "right",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => onRemove(idx)}
          aria-label="품목 삭제"
          style={{
            background: "transparent", border: "none",
            color: "#FF3B5C", fontSize: 16,
            padding: "2px 6px", cursor: "pointer",
            minHeight: 32,
          }}
        >×</button>
      </div>

      {/* 세부 라벨 — └ 들여쓰기 (가격 없음) */}
      {subItems.map((sub, sIdx) => (
        <div
          key={sIdx}
          style={{
            display: "flex", gap: 5, alignItems: "center",
            marginTop: 4, paddingLeft: 16,
          }}
        >
          <span style={{
            color: "var(--text-secondary)", fontSize: 12,
            width: 12, textAlign: "center",
          }}>└</span>
          <input
            value={sub}
            onChange={e => setSub(sIdx, e.target.value)}
            placeholder="세부 항목"
            style={subInputStyle}
          />
          <button
            type="button"
            onClick={() => removeSub(sIdx)}
            aria-label="세부 삭제"
            style={{
              background: "transparent", border: "none",
              color: "#999", fontSize: 13,
              padding: "1px 5px", cursor: "pointer",
            }}
          >×</button>
        </div>
      ))}

      {/* 세부 추가 버튼 */}
      <div style={{ marginTop: 6, paddingLeft: 16 }}>
        <button
          type="button"
          onClick={addSub}
          style={{
            padding: "3px 9px",
            background: "transparent",
            border: "1px dashed var(--border)",
            borderRadius: 999,
            color: "var(--text-secondary)",
            fontSize: 11,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          + 세부 항목
        </button>
      </div>
    </div>
  );
}

const PRESET_ITEMS = [
  "에어컨 청소",
  "냉매 충전",
  "냉매 점검",
  "설치",
  "철거",
  "출장비",
  "송풍팬 분해",
  "실외기 청소",
];

const RECIPIENT_OPTS = [
  { v: "individual", label: "개인" },
  { v: "business",   label: "사업자" },
];

const DOC_OPTS = [
  { v: "invoice", label: "거래명세서" },
  { v: "receipt", label: "영수증" },
];

const VAT_OPTS = [
  { v: "exclusive", label: "부가세 별도" },
  { v: "inclusive", label: "부가세 포함" },
];

const fmtKRW = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;

// ──────────────────────────────────────────────
// 액션 버튼 묶음 — 전체폭 세로 스택, 동일 규격 (2026-06-19 정리).
//   순서: [💬 카톡 공유 (메인)] [🖼 이미지 (아웃라인)] [📄 PDF (아웃라인)]
//   카톡만 노랑(메인 액션), 이미지/PDF 는 동일 아웃라인. PC·모바일 동일 레이아웃.
// ──────────────────────────────────────────────
function DocActionBar({ issuing, onAction }) {
  const baseBtn = {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 14, fontWeight: 700,
    fontFamily: "inherit",
    cursor: issuing ? "not-allowed" : "pointer",
    opacity: issuing ? 0.6 : 1,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxSizing: "border-box",
  };
  const outlineBtn = {
    ...baseBtn,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };
  const kakaoBtn = {
    ...baseBtn,
    background: "#FEE500",
    border: "1px solid #FEE500",
    color: "#391B1B",
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      gap: 8, marginTop: 10,
    }}>
      <button
        type="button"
        onClick={() => onAction("kakao")}
        disabled={issuing}
        style={kakaoBtn}
      >
        <span>💬</span>
        <span>{issuing ? "생성 중…" : "카톡 공유"}</span>
      </button>
      <button
        type="button"
        onClick={() => onAction("image")}
        disabled={issuing}
        style={outlineBtn}
      >
        <span>🖼</span>
        <span>{issuing ? "생성 중…" : "이미지"}</span>
      </button>
      <button
        type="button"
        onClick={() => onAction("pdf")}
        disabled={issuing}
        style={outlineBtn}
      >
        <span>📄</span>
        <span>{issuing ? "생성 중…" : "PDF"}</span>
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
function kstTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function ymdToKoreanDate(ymd) {
  if (!ymd || typeof ymd !== "string") return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[1]}년 ${m[2]}월 ${m[3]}일`;
}

// 2026-06-19 Step 2b — 기사 본인 영수증 발행 흐름 시 props 확장.
//   engineerMode=true 일 때:
//     · 발행처 드롭다운 숨김 (본인 user_id 자동)
//     · 카톡 텍스트 분석 섹션 숨김
//     · task 에서 받는분/품목/금액/거래일자 자동 채움 (mount 1회)
//     · 사업자 미등록 시 안내 + onOpenBusinessSetup 콜백 (선택)
export default function DocIssueScreen({
  user, engineers = [], onBack,
  engineerMode = false,
  task = null,
  onOpenBusinessSetup = null,
}) {
  const isDark = useIsDark();
  // 2026-06-19 — actor fallback 보강. PWA login 응답 키 user_id(snake) /
  //   userId(camel) / id 셋 다 시도. camel 누락 시 actor=null → 사업자
  //   정보 조회 자체가 안 일어나 미등록으로 잘못 보이는 사고 차단.
  const actor  = user?.user_id || user?.userId || user?.id || null;

  // 발행처 (기사) 선택 — 활성 기사만 + code asc.
  const activeEngineers = useMemo(() => {
    return (engineers || [])
      .filter(e => e?.active === true || e?.status === "active" || e?.is_active === true)
      .slice()
      .sort((a, b) => String(a.engineerId || a.id || "").localeCompare(String(b.engineerId || b.id || "")));
  }, [engineers]);

  // 기사 모드 — 본인 user_id 가 곧 issuerCode 대용 (드롭다운 X, 자동 사업자 정보 로드).
  const [issuerCode, setIssuerCode] = useState(""); // 운영자 모드 — engineerId (E001 등)
  const [issuerInfo, setIssuerInfo] = useState(null); // get_engineer_business_info row
  const [issuerLoading, setIssuerLoading] = useState(false);
  const [issuerError, setIssuerError] = useState("");

  // 카톡 붙여넣기 텍스트 (운영자 모드만 사용)
  const [pasteText, setPasteText] = useState("");

  // 받는분 — engineerMode 진입 시 task.customerName / task.address 로 자동 채움 (아래 useEffect).
  const [recipientType, setRecipientType] = useState("individual"); // individual | business
  const [recipientName, setRecipientName] = useState("");
  const [recipientBizName, setRecipientBizName] = useState("");
  const [recipientBizNo, setRecipientBizNo]   = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  // 2026-07-04 — 개인 수신자 연락처 (사업자 탭 무영향). 서류 템플릿 recipient.phone 렌더.
  //   자동 채움: 카톡 자동분석 첫 매치 + engineerMode task.phone. 사용자 수정 가능.
  const [recipientPhone, setRecipientPhone] = useState("");

  // 품목
  const [items, setItems] = useState([]);

  // 금액 / 부가세
  const [amountRaw, setAmountRaw] = useState(""); // 사용자 입력 그대로 (콤마 포맷)
  const [vatMode, setVatMode]     = useState(engineerMode ? "inclusive" : "inclusive");
  const [showVat, setShowVat]     = useState(true); // 영수증 옵션 — 부가세 미표기

  // 문서 종류 — 기사 모드 기본 '영수증', 운영자 모드 기본 '거래명세서'
  const [docType, setDocType] = useState(engineerMode ? "receipt" : "invoice");

  // 2026-06-19 — 발행 날짜 (수동 변경 가능, 기본 오늘 KST).
  //   거래명세서.거래일자 / 영수증.영수일자 에 반영.
  //   발행번호(YYMMDD-NNN)는 발행 화면이 아닌 generateSerialNo 가 실제 today 기준 — 입력 날짜와 무관.
  const [issueDate, setIssueDate] = useState(() => {
    // 기사 모드 — task.completedAt KST YMD 기본값
    if (engineerMode && task) {
      const at = task.completedAt || task.completed_at;
      if (at) {
        try {
          return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric", month: "2-digit", day: "2-digit",
          }).format(new Date(at));
        } catch (_) {}
      }
    }
    return kstTodayYmd();
  });

  // 2026-06-19 Step 2b — 기사 모드 진입 시 task → form 자동 채움 (mount 1회).
  //   사장님 spec: 판매가만 노출 (그 작업 받은 금액). 원청수수료 / 회사몫 / 다른 작업 X.
  //   품목: task.workItems → "appliance workType" 라벨 + qty (가격은 합계로 따로 표시).
  useEffect(() => {
    if (!engineerMode || !task) return;
    // 받는분 자동 채움 — 기본 '개인' + 고객명/주소/연락처 (task.phone: rowToTask 라인 99).
    setRecipientType("individual");
    setRecipientName(task.customer || task.customerName || "");
    setRecipientAddress(task.address || "");
    setRecipientPhone(task.phone ? formatPhone(task.phone) : "");

    // 품목 — task.workItems 매핑 (가격은 합계 입력칸에서 따로 관리)
    const wis = Array.isArray(task.workItems) ? task.workItems : [];
    const nextItems = wis
      .filter(wi => !(wi.isCanceled ?? wi.is_canceled))
      .map(wi => ({
        label: [wi.appliance, wi.workType].filter(Boolean).join(" ").trim() || "작업 일체",
        qty: Number(wi.qty || 1),
        // 사장님 spec — 판매가만 노출 + 합계로 자동. 개별 단가 X (현장 수정 가능).
      }));
    setItems(nextItems);

    // 금액 자동 — 상품금액 + 현장추가금 (사장님 spec)
    const total =
      Number(task.totalAmount || task.total_amount || 0)
      || (Number(task.productPrice || task.product_price || 0)
        + Number(task.extraFee || task.extra_fee || 0)
        + Number(task.travelFee || task.travel_fee || 0));
    if (total > 0) {
      setAmountRaw(total.toLocaleString("ko-KR"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineerMode, task?.id]);

  // 2026-06-19 Step 2b — 기사 모드: 본인 사업자 정보 자동 로드 (actor=본인).
  useEffect(() => {
    if (!engineerMode || !actor) return;
    let alive = true;
    setIssuerLoading(true);
    setIssuerError("");
    getEngineerBusinessInfo(actor, actor).then(res => {
      if (!alive) return;
      setIssuerLoading(false);
      if (!res?.ok) {
        setIssuerInfo(null);
        setIssuerError(res?.error || "사업자 정보 조회 실패");
        return;
      }
      setIssuerInfo(res.row || null);
    });
    return () => { alive = false; };
  }, [engineerMode, actor]);

  // 발행처 변경 시 사업자 정보 fetch.
  //
  // 2026-06-19 정정: apiEngineers 가 시트 캐시 기반이라 보통 user_id(UUID)가 결손.
  //   이전: 시트 캐시에서 user_id 없으면 즉시 경고 노출 → E022/E002 같은 정상 기사도
  //         사용자 화면에 "user_id 결손" 경고가 조기 노출 (실제 데이터는 멀쩡, UX만 깨짐).
  //   현재: 시트 캐시 결손이면 supabase users 테이블에서 code→id 한 번 조회.
  //         그 조회까지 실패해야 그때 경고 (DB 에도 진짜 없는 기사일 때만).
  //   같은 패턴: EngineerEditScreen 의 targetUserId useEffect (Mig 141 작업 시 적용).
  //
  // 2026-06-19 Step 2b 정정: 기사 모드(engineerMode=true) 에선 본 useEffect 가
  //   issuerCode='' early return 으로 setIssuerInfo(null) 호출 → 위쪽 engineerMode
  //   useEffect 가 set 한 사업자 정보를 즉시 덮어쓰는 사고. 기사 모드는 전용
  //   useEffect 가 처리하므로 본 useEffect 는 운영자 모드에서만 동작.
  useEffect(() => {
    if (engineerMode) return; // 기사 모드 — 위 useEffect 가 본인 user_id 로 직접 처리
    if (!issuerCode || !actor) {
      setIssuerInfo(null);
      setIssuerError("");
      return;
    }
    let alive = true;
    setIssuerLoading(true);
    setIssuerError("");

    async function loadIssuer() {
      const eng = activeEngineers.find(e => (e.engineerId || e.id) === issuerCode);
      let targetUserId = eng?.user_id || eng?.userUuid || eng?.uuid;

      // 시트 캐시에 user_id 없으면 DB users 에서 code 로 즉석 조회.
      if (!targetUserId) {
        const { data, error } = await supabase
          .from("users")
          .select("id")
          .eq("code", issuerCode)
          .maybeSingle();
        if (!alive) return;
        if (error) {
          setIssuerLoading(false);
          setIssuerInfo(null);
          setIssuerError(error.message || "기사 조회 실패");
          return;
        }
        if (data?.id) {
          targetUserId = data.id;
        }
      }

      if (!alive) return;
      if (!targetUserId) {
        setIssuerLoading(false);
        setIssuerInfo(null);
        setIssuerError("DB 에서 기사를 찾을 수 없습니다 (code 확인 필요)");
        return;
      }

      const res = await getEngineerBusinessInfo(targetUserId, actor);
      if (!alive) return;
      setIssuerLoading(false);
      if (!res?.ok) {
        setIssuerInfo(null);
        setIssuerError(res?.error || "사업자 정보 조회 실패");
        return;
      }
      setIssuerInfo(res.row || null);
    }

    loadIssuer();
    return () => { alive = false; };
  }, [issuerCode, actor, activeEngineers, engineerMode]);

  // 자동 분석 → form 미리 채움 (best-effort).
  function handleAutoParse() {
    const r = parseDocIssuePaste(pasteText);
    if (r.address && !recipientAddress) setRecipientAddress(r.address);
    if (r.phone   && !recipientPhone)   setRecipientPhone(r.phone);
    if (r.items && r.items.length > 0) {
      setItems(prev => prev.concat(r.items.map(it => ({
        label: it.label,
        qty:   it.qty || 1,
        price: it.price,
      }))));
    }
    if (r.vatMode) setVatMode(r.vatMode);
    const amount = r.vatMode === "exclusive" ? r.supplyPrice : r.totalAmount;
    if (amount) {
      setAmountRaw(Number(amount).toLocaleString("ko-KR"));
    }
  }

  function handleAddPreset(label) {
    setItems(prev => prev.concat([{ label, qty: 1 }]));
  }
  function handleAddBlank() {
    setItems(prev => prev.concat([{ label: "", qty: 1 }]));
  }
  function handleChangeItem(idx, next) {
    setItems(prev => prev.map((it, i) => i === idx ? next : it));
  }
  function handleRemoveItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // 금액 input — 콤마 포맷
  function handleAmountChange(v) {
    const digits = String(v || "").replace(/\D/g, "");
    setAmountRaw(digits ? Number(digits).toLocaleString("ko-KR") : "");
  }
  const amountNum = Number(String(amountRaw).replace(/\D/g, "")) || 0;
  const vatBreak  = useMemo(() => computeVatBreakdown(amountNum, vatMode), [amountNum, vatMode]);

  // 2026-06-19 Step 4 — 실제 PDF·PNG 생성 + 다운로드 / Web Share files.
  //   jspdf + html2canvas + 양식 컴포넌트 모두 dynamic import (lazy chunk).
  //   canvas 한 번 캡처 후 PDF/PNG 둘 다 변환 가능.
  const [issuing, setIssuing] = useState(false);

  // 2026-06-19 Step 3-1 — serialNo 는 issue_document RPC 응답(doc_no)에서 받음.
  //   generateSerialNo() random 폐기. canvas 생성 전 RPC 호출 흐름이라 본
  //   함수는 docNo 를 인자로 받기만 함.
  async function buildCanvas(docNo) {
    const { renderInvoiceCanvas, renderReceiptCanvas } =
      await _importDocIssueRender();

    const issuer = issuerInfo || {};
    const recipient = {
      type:    recipientType,
      name:    recipientName,
      bizName: recipientBizName,
      bizNo:   recipientBizNo,
      address: recipientAddress,
      // 2026-07-04 — 개인 수신자 연락처. 사업자 탭에도 필드 전달되나 InvoiceTemplate/ReceiptTemplate
      //   가 recipient.type='individual' 분기에서만 셀 노출하므로 사업자 서류엔 영향 0.
      phone:   recipientPhone,
    };
    const safeItems = items.filter(it => (it.label || "").trim() !== "");
    const issuedAtKor = ymdToKoreanDate(issueDate);

    const common = {
      issuer, recipient,
      items:  safeItems,
      vat:    vatBreak,
      vatMode,
      issuedAt: issuedAtKor,
    };

    if (docType === "invoice") {
      return { canvas: await renderInvoiceCanvas(common), kind: "거래명세서" };
    }
    return {
      canvas: await renderReceiptCanvas({
        ...common,
        hideVat: !showVat,
        serialNo: docNo,
      }),
      kind: "영수증",
    };
  }

  function makeFilename(kind, ext) {
    const ymd = (issueDate || kstTodayYmd()).replace(/-/g, "");
    return `${kind}_${ymd}.${ext}`;
  }

  function preCheck() {
    if (!issuerInfo) {
      if (typeof window !== "undefined") window.alert("발행처(기사) 사업자 정보가 비어 있습니다. 먼저 선택/등록 후 다시 시도해주세요.");
      return false;
    }
    if (items.length === 0 || items.every(it => !(it.label || "").trim())) {
      if (typeof window !== "undefined") window.alert("품목을 1개 이상 입력해주세요.");
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate || "")) {
      if (typeof window !== "undefined") window.alert("발행 날짜가 올바르지 않습니다.");
      return false;
    }
    return true;
  }

  async function handleIssue(action) {
    if (issuing) return;
    if (!preCheck()) return;

    // 발행처 user_id 확인 (RPC 호출 + canvas issuer 정보 일치 보장)
    const issuerUserId = issuerInfo?.user_id;
    if (!issuerUserId) {
      if (typeof window !== "undefined") window.alert("발행처 정보가 없습니다. 발행처를 다시 선택해주세요.");
      return;
    }

    setIssuing(true);
    try {
      // [1] 발행 이력 + 채번 (Mig 143 issue_document) — canvas 생성 전 수행.
      //   RPC 가 (issuer_business_no, 발행일 KST) 단위 NNN 채번 + doc_issues INSERT.
      //   같은 사업자번호 공유 기사(E002·E022)는 통합 카운터.
      const safeItems = items
        .filter(it => (it.label || "").trim() !== "")
        .map(it => ({
          label: it.label,
          qty:   Number(it.qty) || 1,
          price: it.price != null ? Number(it.price) : undefined,
          subItems: Array.isArray(it.subItems)
            ? it.subItems.filter(s => (s || "").trim() !== "")
            : [],
        }));
      const issueRes = await issueDocument({
        actor,
        issuerUserId,
        payload: {
          doc_type:           docType,
          recipient_type:     recipientType,
          recipient_name:     recipientName || null,
          recipient_biz_name: recipientBizName || null,
          recipient_biz_no:   recipientBizNo || null,
          recipient_address:  recipientAddress || null,
          supply:             vatBreak.supply,
          vat:                vatBreak.vat,
          amount:             vatBreak.total,
          items:              safeItems,
          issue_date:         issueDate || null,
        },
        taskId: engineerMode && task?.id ? task.id : null,
      });
      if (!issueRes?.ok) {
        if (typeof window !== "undefined") window.alert(`발행 실패 — ${issueRes?.error || "알 수 없는 오류"}`);
        return;
      }
      const docNo = issueRes.doc_no;

      // [2] canvas (영수증은 doc_no 가 발행번호로 표시됨, 거래명세서는 양식에 발행번호 영역 없음)
      const { canvas, kind } = await buildCanvas(docNo);
      const {
        canvasToPdfBlob, canvasToPngBlob,
        blobToFile, tryShareFiles, downloadOrOpenBlob,
      } = await import("../../lib/docIssueRender.js");

      if (action === "image") {
        const png = await canvasToPngBlob(canvas);
        downloadOrOpenBlob(png, makeFilename(kind, "png"));
        return;
      }
      if (action === "pdf") {
        const pdf = await canvasToPdfBlob(canvas);
        downloadOrOpenBlob(pdf, makeFilename(kind, "pdf"));
        return;
      }
      if (action === "kakao") {
        // 카톡 공유 — PNG 우선 시도 (모바일 첨부 호환성 ↑), 실패 시 PDF, 그래도 실패 시 다운로드.
        const png = await canvasToPngBlob(canvas);
        const pngFile = blobToFile(png, makeFilename(kind, "png"), "image/png");
        const shareTitle = kind;
        const shareText  = `${kind} (${issuerInfo.business_name || ""})`;

        const sharedPng = await tryShareFiles({ title: shareTitle, text: shareText, file: pngFile });
        if (sharedPng) return;

        // PNG share 실패 → PDF 재시도.
        const pdf = await canvasToPdfBlob(canvas);
        const pdfFile = blobToFile(pdf, makeFilename(kind, "pdf"), "application/pdf");
        const sharedPdf = await tryShareFiles({ title: shareTitle, text: shareText, file: pdfFile });
        if (sharedPdf) return;

        // 둘 다 실패 → PNG 다운로드 + 안내.
        downloadOrOpenBlob(png, makeFilename(kind, "png"));
        if (typeof window !== "undefined") {
          window.alert("이 기기는 파일 공유를 지원하지 않습니다.\n다운로드한 이미지를 카톡에 직접 첨부해주세요.");
        }
      }
    } catch (err) {
      console.error("[handleIssue]", err);
      if (typeof window !== "undefined") {
        window.alert("문서 생성 중 오류가 발생했습니다. 콘솔 로그를 확인해주세요.");
      }
    } finally {
      setIssuing(false);
    }
  }

  // ──────────────────────────────────────────────
  // 렌더
  // ──────────────────────────────────────────────
  return (
    <div style={{
      background: "var(--bg-primary)",
      minHeight: "100vh",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Pretendard', sans-serif",
      paddingBottom: 70,
    }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: "transparent", border: "none",
            fontSize: 20, padding: 2, cursor: "pointer",
            color: "var(--text-primary)",
            minHeight: 32,
          }}
        >←</button>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px" }}>
          📄 서류 발행
        </div>
      </div>

      <div style={{ padding: 10, maxWidth: 720, margin: "0 auto" }}>
        {/* 1) 발행처 — 기사 모드는 본인 고정, 운영자 모드는 드롭다운 */}
        <Section
          title={engineerMode ? "발행처 (내 사업자 정보)" : "발행처 (기사)"}
          hint={engineerMode
            ? "본인 사업자 정보가 자동으로 적용됩니다. 변경은 [내 정보 → ⚙ 톱니]에서."
            : "선택하면 등록된 사업자 정보를 자동으로 가져옵니다."}
          isDark={isDark}
        >
          {!engineerMode && (
            <select
              value={issuerCode}
              onChange={e => setIssuerCode(e.target.value)}
              style={{
                width: "100%",
                minHeight: 44,
                padding: "8px 10px",
                fontSize: 13, fontFamily: "inherit",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            >
              <option value="">기사를 선택하세요</option>
              {activeEngineers.map(e => {
                const code = e.engineerId || e.id || "";
                const name = e.name || "";
                return (
                  <option key={code} value={code}>
                    {code} · {name}
                  </option>
                );
              })}
            </select>
          )}

          {issuerLoading && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
              사업자 정보 불러오는 중…
            </div>
          )}
          {issuerError && (
            <div style={{
              marginTop: 6, fontSize: 12,
              color: "#FF6B85",
              padding: "6px 9px",
              background: "rgba(255,107,133,0.08)",
              border: "1px solid rgba(255,107,133,0.3)",
              borderRadius: 6,
            }}>
              ⚠️ {issuerError}
            </div>
          )}
          {/* 기사 모드 + 사업자 정보 미등록 안내 (business_name 비어있을 때) */}
          {engineerMode && !issuerLoading && !issuerError && (!issuerInfo || !issuerInfo.business_name) && (
            <div style={{
              marginTop: 7,
              padding: "10px 12px",
              background: "rgba(255,184,0,0.08)",
              border: "1px solid rgba(255,184,0,0.4)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-primary)",
              lineHeight: 1.55,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ 사업자 정보가 등록되지 않았습니다</div>
              <div style={{ color: "var(--text-secondary)", marginBottom: onOpenBusinessSetup ? 8 : 0 }}>
                영수증 발행에는 사업자 정보가 필요합니다.
                <br/>[내 정보 → ⚙ 톱니]에서 먼저 등록해주세요.
              </div>
              {onOpenBusinessSetup && (
                <button
                  type="button"
                  onClick={onOpenBusinessSetup}
                  style={{
                    minHeight: 40,
                    padding: "8px 14px",
                    background: "#FF1B8D",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  사업자 정보 등록하러 가기
                </button>
              )}
            </div>
          )}
          {issuerInfo && !issuerLoading && (!engineerMode || issuerInfo.business_name) && (
            <div style={{
              marginTop: 7,
              padding: "7px 9px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}>
              <div><b style={{ color: "var(--text-primary)" }}>{issuerInfo.business_name || "—"}</b>
                {" · "}{issuerInfo.representative_name || "대표자 미입력"}</div>
              <div>사업자번호 {issuerInfo.business_no || "미입력"} · {issuerInfo.tax_type || "과세유형 미설정"}</div>
              <div>{issuerInfo.business_address || "사업장 주소 미입력"}</div>
              <div>{issuerInfo.bank_name || "—"} {issuerInfo.bank_account || ""}</div>
            </div>
          )}
        </Section>

        {/* 2) 카톡 붙여넣기 — 운영자 모드 전용 (기사 모드는 task 자동 채움으로 대체) */}
        {!engineerMode && (
        <Section
          title="카톡 붙여넣기 (자동 분석)"
          hint="주소·품목·금액·부가세표기를 추출합니다. 결과는 아래 칸에서 수정 가능합니다."
          isDark={isDark}
        >
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="여기에 카톡 메시지를 붙여넣으세요"
            rows={4}
            style={{
              width: "100%",
              padding: 8,
              fontSize: 13, fontFamily: "inherit",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              lineHeight: 1.4,
            }}
          />
          <button
            type="button"
            onClick={handleAutoParse}
            disabled={!pasteText.trim()}
            style={{
              marginTop: 6,
              minHeight: 44,
              padding: "8px 12px",
              background: pasteText.trim() ? "#FF1B8D" : "var(--bg-secondary)",
              color: pasteText.trim() ? "#fff" : "var(--text-secondary)",
              border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              fontFamily: "inherit",
              cursor: pasteText.trim() ? "pointer" : "not-allowed",
            }}
          >
            🔎 자동 분석
          </button>
        </Section>
        )}

        {/* 3) 받는분 */}
        <Section title="받는분" isDark={isDark}>
          <div style={{ marginBottom: 7 }}>
            <TwoToggle
              value={recipientType}
              options={RECIPIENT_OPTS}
              onChange={setRecipientType}
              isDark={isDark}
            />
          </div>

          {recipientType === "individual" ? (
            <>
              <LabeledInput
                label="이름"
                value={recipientName}
                onChange={setRecipientName}
                placeholder="예: 홍길동"
              />
              <LabeledInput
                label="연락처"
                value={recipientPhone}
                onChange={(v) => setRecipientPhone(formatPhone(v))}
                placeholder="010-1234-5678"
                mono
                inputMode="tel"
              />
              <LabeledInput
                label="주소"
                value={recipientAddress}
                onChange={setRecipientAddress}
                placeholder="시·군·구 + 도로명 + 동/호"
              />
            </>
          ) : (
            <>
              <LabeledInput
                label="상호"
                value={recipientBizName}
                onChange={setRecipientBizName}
                placeholder="예: ○○상사"
              />
              <LabeledInput
                label="사업자번호"
                value={recipientBizNo}
                onChange={setRecipientBizNo}
                placeholder="000-00-00000"
                mono
                inputMode="numeric"
              />
              <LabeledInput
                label="주소"
                value={recipientAddress}
                onChange={setRecipientAddress}
                placeholder="시·군·구 + 도로명 + 동/호"
              />
              <div style={{
                fontSize: 11, color: "var(--text-secondary)",
                padding: "6px 0",
              }}>
                ※ 사업자 OCR 자동 인식은 v2 단계에서 추가 예정.
              </div>
            </>
          )}
        </Section>

        {/* 4) 품목 */}
        <Section
          title={`품목 (${items.length}건)`}
          hint="아래 프리셋을 눌러 빠르게 추가하거나, 직접 입력하세요."
          isDark={isDark}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
            {PRESET_ITEMS.map(label => (
              <button
                key={label}
                type="button"
                onClick={() => handleAddPreset(label)}
                style={{
                  padding: "5px 9px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                + {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleAddBlank}
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                border: "1px dashed var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              + 직접 입력
            </button>
          </div>

          {items.length === 0 ? (
            <div style={{
              fontSize: 12, fontStyle: "italic",
              color: "var(--text-secondary)",
              padding: "5px 0",
            }}>
              품목이 없습니다. 위 버튼으로 추가하세요.
            </div>
          ) : (
            items.map((it, i) => (
              <ItemChip
                key={i}
                item={it}
                idx={i}
                onChange={handleChangeItem}
                onRemove={handleRemoveItem}
              />
            ))
          )}
        </Section>

        {/* 5) 금액 / 부가세 */}
        <Section
          title="금액 / 부가세"
          hint="부가세 표기 방식에 따라 공급가·부가세가 자동 계산됩니다."
          isDark={isDark}
        >
          <div style={{ marginBottom: 7 }}>
            <TwoToggle
              value={vatMode}
              options={VAT_OPTS}
              onChange={setVatMode}
              isDark={isDark}
            />
          </div>

          <LabeledInput
            label={vatMode === "exclusive" ? "공급가 (부가세 별도)" : "합계 금액 (부가세 포함)"}
            value={amountRaw}
            onChange={handleAmountChange}
            placeholder="예: 350,000"
            mono
            inputMode="numeric"
          />

          <div style={{
            padding: 10,
            background: "var(--bg-secondary)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}>
            <div>공급가 <span style={{ float: "right", color: "var(--text-primary)", fontFamily: "monospace" }}>{fmtKRW(vatBreak.supply)}</span></div>
            <div>부가세 <span style={{ float: "right", color: "var(--text-primary)", fontFamily: "monospace" }}>{fmtKRW(vatBreak.vat)}</span></div>
            <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6, fontWeight: 700 }}>
              합계 <span style={{ float: "right", color: "var(--text-primary)", fontFamily: "monospace" }}>{fmtKRW(vatBreak.total)}</span>
            </div>
          </div>

          {docType === "receipt" && (
            <label style={{
              display: "flex", alignItems: "center", gap: 6,
              marginTop: 7, fontSize: 12,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={!showVat}
                onChange={e => setShowVat(!e.target.checked)}
              />
              영수증에 부가세 별도 표기 생략
            </label>
          )}
        </Section>

        {/* 6) 문서 종류 + 발행 날짜 */}
        <Section title="문서 종류 / 발행 날짜" isDark={isDark}>
          <div style={{ marginBottom: 7 }}>
            <TwoToggle
              value={docType}
              options={DOC_OPTS}
              onChange={setDocType}
              isDark={isDark}
            />
          </div>
          <LabeledInput
            label={`${docType === "invoice" ? "거래일자" : "영수일자"} (기본 오늘 · 수동 변경 가능)`}
            value={issueDate}
            onChange={setIssueDate}
            type="date"
            className="doc-date-input"
          />
          {docType === "receipt" && (
            <div style={{
              marginTop: 2, fontSize: 11,
              color: "var(--text-secondary)",
            }}>
              ※ 발행번호(YYMMDD-NNN)는 실제 발행 시점 기준이며, 위 영수일자와는 별개입니다.
            </div>
          )}
        </Section>

        {/* 7) 액션 — 전체폭 세로 스택 (카톡 메인 / 이미지·PDF 아웃라인) */}
        <DocActionBar
          issuing={issuing}
          onAction={handleIssue}
        />
        <div style={{
          marginTop: 7, fontSize: 11,
          color: "var(--text-secondary)", textAlign: "center",
          lineHeight: 1.45,
        }}>
          ※ 카톡 공유는 시스템 공유 시트로 동작합니다 (이미지 우선, 미지원 시 PDF, 그래도 미지원이면 다운로드 폴백).
        </div>
      </div>
    </div>
  );
}
