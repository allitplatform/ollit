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
import { useIsPc } from "../../utils/useIsPc.js";
import { supabase } from "../../lib/supabase.js";
import { getEngineerBusinessInfo } from "../../lib/engineerBusinessInfoDb.js";
import { parseDocIssuePaste, computeVatBreakdown } from "../../lib/docIssueParser.js";

// ──────────────────────────────────────────────
// 모듈 최상위 — 부모 리렌더에 input remount 안 일으키도록 분리.
//   (직전 EngineerBusinessInfoCard 포커스 손실 교훈 — 본문 안 정의 금지.)
// ──────────────────────────────────────────────
function Section({ title, hint, isDark, children }) {
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: hint ? 4 : 10,
        letterSpacing: "-0.1px",
      }}>
        {title}
      </div>
      {hint && (
        <div style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginBottom: 10,
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
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(opt => {
        const on = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
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

function LabeledInput({ label, value, onChange, placeholder, mono, type = "text", inputMode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 4,
      }}>{label}</div>
      <input
        type={type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: mono ? "monospace" : "inherit",
          letterSpacing: mono ? 0.4 : 0,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function ItemChip({ item, idx, onChange, onRemove }) {
  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "center",
      padding: "8px 10px",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      marginBottom: 6,
    }}>
      <input
        value={item.label}
        onChange={e => onChange(idx, { ...item, label: e.target.value })}
        placeholder="품목"
        style={{
          flex: 2, minWidth: 0,
          padding: "6px 8px",
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
        style={{
          width: 56,
          padding: "6px 8px",
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
        placeholder="단가"
        style={{
          flex: 1, minWidth: 70,
          padding: "6px 8px",
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
          padding: "4px 6px", cursor: "pointer",
        }}
      >×</button>
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
// 액션 버튼 묶음 — PC vs 모바일 우선순위 다름.
//   PC:   [이미지][PDF][카톡 공유]
//   모바일: [💬 카톡 공유][🖼 이미지][PDF]  (카톡 강조 + PDF 보조)
// ──────────────────────────────────────────────
function DocActionBar({ isPc, issuing, onAction }) {
  const btnBase = {
    padding: 14,
    border: "none",
    borderRadius: 12,
    fontSize: 14, fontWeight: 700,
    fontFamily: "inherit",
    cursor: issuing ? "not-allowed" : "pointer",
    opacity: issuing ? 0.6 : 1,
  };
  const ImageBtn = (
    <button
      type="button"
      key="image"
      onClick={() => onAction("image")}
      disabled={issuing}
      style={{
        ...btnBase,
        flex: 1,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    >
      {issuing ? "생성 중…" : "🖼 이미지"}
    </button>
  );
  const PdfBtn = (
    <button
      type="button"
      key="pdf"
      onClick={() => onAction("pdf")}
      disabled={issuing}
      style={{
        ...btnBase,
        flex: isPc ? 1 : 0.6,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    >
      {issuing ? "생성 중…" : "📄 PDF"}
    </button>
  );
  const KakaoBtn = (
    <button
      type="button"
      key="kakao"
      onClick={() => onAction("kakao")}
      disabled={issuing}
      style={{
        ...btnBase,
        flex: isPc ? 1 : 1.6,
        background: "#FEE500",
        color: "#391B1B",
      }}
    >
      {issuing ? "생성 중…" : "💬 카톡 공유"}
    </button>
  );

  if (isPc) {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        {ImageBtn}
        {PdfBtn}
        {KakaoBtn}
      </div>
    );
  }
  // 모바일: 카톡 우선
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        {KakaoBtn}
        {ImageBtn}
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        {PdfBtn}
      </div>
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

export default function DocIssueScreen({ user, engineers = [], onBack }) {
  const isDark = useIsDark();
  const isPc   = useIsPc();
  const actor  = user?.user_id || user?.id || null;

  // 발행처 (기사) 선택 — 활성 기사만 + code asc.
  const activeEngineers = useMemo(() => {
    return (engineers || [])
      .filter(e => e?.active === true || e?.status === "active" || e?.is_active === true)
      .slice()
      .sort((a, b) => String(a.engineerId || a.id || "").localeCompare(String(b.engineerId || b.id || "")));
  }, [engineers]);

  const [issuerCode, setIssuerCode] = useState(""); // engineerId (E001 등)
  const [issuerInfo, setIssuerInfo] = useState(null); // get_engineer_business_info row
  const [issuerLoading, setIssuerLoading] = useState(false);
  const [issuerError, setIssuerError] = useState("");

  // 카톡 붙여넣기 텍스트
  const [pasteText, setPasteText] = useState("");

  // 받는분
  const [recipientType, setRecipientType] = useState("individual"); // individual | business
  const [recipientName, setRecipientName] = useState("");
  const [recipientBizName, setRecipientBizName] = useState("");
  const [recipientBizNo, setRecipientBizNo]   = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  // 품목
  const [items, setItems] = useState([]);

  // 금액 / 부가세
  const [amountRaw, setAmountRaw] = useState(""); // 사용자 입력 그대로 (콤마 포맷)
  const [vatMode, setVatMode]     = useState("inclusive");
  const [showVat, setShowVat]     = useState(true); // 영수증 옵션 — 부가세 미표기

  // 문서 종류
  const [docType, setDocType] = useState("invoice");

  // 2026-06-19 — 발행 날짜 (수동 변경 가능, 기본 오늘 KST).
  //   거래명세서.거래일자 / 영수증.영수일자 에 반영.
  //   발행번호(YYMMDD-NNN)는 발행 화면이 아닌 generateSerialNo 가 실제 today 기준 — 입력 날짜와 무관.
  const [issueDate, setIssueDate] = useState(() => kstTodayYmd());

  // 발행처 변경 시 사업자 정보 fetch.
  //
  // 2026-06-19 정정: apiEngineers 가 시트 캐시 기반이라 보통 user_id(UUID)가 결손.
  //   이전: 시트 캐시에서 user_id 없으면 즉시 경고 노출 → E022/E002 같은 정상 기사도
  //         사용자 화면에 "user_id 결손" 경고가 조기 노출 (실제 데이터는 멀쩡, UX만 깨짐).
  //   현재: 시트 캐시 결손이면 supabase users 테이블에서 code→id 한 번 조회.
  //         그 조회까지 실패해야 그때 경고 (DB 에도 진짜 없는 기사일 때만).
  //   같은 패턴: EngineerEditScreen 의 targetUserId useEffect (Mig 141 작업 시 적용).
  useEffect(() => {
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
  }, [issuerCode, actor, activeEngineers]);

  // 자동 분석 → form 미리 채움 (best-effort).
  function handleAutoParse() {
    const r = parseDocIssuePaste(pasteText);
    if (r.address && !recipientAddress) setRecipientAddress(r.address);
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

  async function buildCanvas() {
    const { renderInvoiceCanvas, renderReceiptCanvas, generateSerialNo } =
      await import("../../lib/docIssueRender.js");

    const issuer = issuerInfo || {};
    const recipient = {
      type:    recipientType,
      name:    recipientName,
      bizName: recipientBizName,
      bizNo:   recipientBizNo,
      address: recipientAddress,
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
        serialNo: generateSerialNo(),
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

    setIssuing(true);
    try {
      const { canvas, kind } = await buildCanvas();
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
      paddingBottom: 100,
    }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: "transparent", border: "none",
            fontSize: 22, padding: 4, cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >←</button>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px" }}>
          📄 서류 발행
        </div>
      </div>

      <div style={{ padding: 14, maxWidth: 720, margin: "0 auto" }}>
        {/* 1) 발행처 */}
        <Section
          title="발행처 (기사)"
          hint="선택하면 등록된 사업자 정보를 자동으로 가져옵니다."
          isDark={isDark}
        >
          <select
            value={issuerCode}
            onChange={e => setIssuerCode(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14, fontFamily: "inherit",
              border: "1px solid var(--border)",
              borderRadius: 10,
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

          {issuerLoading && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              사업자 정보 불러오는 중…
            </div>
          )}
          {issuerError && (
            <div style={{
              marginTop: 8, fontSize: 12,
              color: "#FF6B85",
              padding: "8px 10px",
              background: "rgba(255,107,133,0.08)",
              border: "1px solid rgba(255,107,133,0.3)",
              borderRadius: 8,
            }}>
              ⚠️ {issuerError}
            </div>
          )}
          {issuerInfo && !issuerLoading && (
            <div style={{
              marginTop: 10,
              padding: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}>
              <div><b style={{ color: "var(--text-primary)" }}>{issuerInfo.business_name || "—"}</b>
                {" · "}{issuerInfo.representative_name || "대표자 미입력"}</div>
              <div>사업자번호 {issuerInfo.business_no || "미입력"} · {issuerInfo.tax_type || "과세유형 미설정"}</div>
              <div>{issuerInfo.business_address || "사업장 주소 미입력"}</div>
              <div>{issuerInfo.bank_name || "—"} {issuerInfo.bank_account || ""}</div>
            </div>
          )}
        </Section>

        {/* 2) 카톡 붙여넣기 */}
        <Section
          title="카톡 붙여넣기 (자동 분석)"
          hint="주소·품목·금액·부가세표기를 추출합니다. 결과는 아래 칸에서 수정 가능합니다."
          isDark={isDark}
        >
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="여기에 카톡 메시지를 붙여넣으세요"
            rows={5}
            style={{
              width: "100%",
              padding: 10,
              fontSize: 13, fontFamily: "inherit",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={handleAutoParse}
            disabled={!pasteText.trim()}
            style={{
              marginTop: 8,
              padding: "10px 14px",
              background: pasteText.trim() ? "#FF1B8D" : "var(--bg-secondary)",
              color: pasteText.trim() ? "#fff" : "var(--text-secondary)",
              border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              fontFamily: "inherit",
              cursor: pasteText.trim() ? "pointer" : "not-allowed",
            }}
          >
            🔎 자동 분석
          </button>
        </Section>

        {/* 3) 받는분 */}
        <Section title="받는분" isDark={isDark}>
          <div style={{ marginBottom: 10 }}>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {PRESET_ITEMS.map(label => (
              <button
                key={label}
                type="button"
                onClick={() => handleAddPreset(label)}
                style={{
                  padding: "6px 10px",
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
                padding: "6px 10px",
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
              padding: "8px 0",
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
          <div style={{ marginBottom: 10 }}>
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
              marginTop: 10, fontSize: 12,
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
          <div style={{ marginBottom: 10 }}>
            <TwoToggle
              value={docType}
              options={DOC_OPTS}
              onChange={setDocType}
              isDark={isDark}
            />
          </div>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 4,
            }}>
              {docType === "invoice" ? "거래일자" : "영수일자"} (기본 오늘 · 수동 변경 가능)
            </div>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: "inherit",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {docType === "receipt" && (
              <div style={{
                marginTop: 6, fontSize: 11,
                color: "var(--text-secondary)",
              }}>
                ※ 발행번호(YYMMDD-NNN)는 실제 발행 시점 기준이며, 위 영수일자와는 별개입니다.
              </div>
            )}
          </div>
        </Section>

        {/* 7) 액션 — 이미지 / PDF / 카톡 공유 (모바일은 이미지·카톡 강조) */}
        <DocActionBar
          isPc={isPc}
          issuing={issuing}
          onAction={handleIssue}
        />
        <div style={{
          marginTop: 10, fontSize: 11,
          color: "var(--text-secondary)", textAlign: "center",
          lineHeight: 1.6,
        }}>
          ※ 카톡 공유는 시스템 공유 시트로 동작합니다 (이미지 우선, 미지원 시 PDF, 그래도 미지원이면 다운로드 폴백).
        </div>
      </div>
    </div>
  );
}
