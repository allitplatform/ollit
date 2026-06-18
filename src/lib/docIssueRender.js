// 2026-06-19 Step 4 — 거래명세서 / 영수증 PDF 렌더링 + 공유 헬퍼.
//
// 흐름:
//   1) offscreen container (position:fixed, left:-10000px) 생성
//   2) React 양식 컴포넌트(react-dom/client createRoot)로 mount
//   3) 폰트 로드 완료 await (document.fonts.ready)
//   4) html2canvas scale=2 캡처 → 단일 page jsPDF A4 임베드
//   5) Blob 반환. 부모는 다운로드 / Web Share 둘 중 호출.
//
// 라이브러리(jspdf / html2canvas) 와 React 양식은 모두 dynamic import — 발행
// 화면 진입 시점에 lazy load (vite 자동 chunk 분리).
//
// Web Share files 지원:
//   navigator.canShare({ files: [...] }) 가 true 일 때만 share 시도.
//   미지원/실패 시 부모는 새 탭 fallback (window.open(blobUrl)).

const A4_W_PX = 793;  // 컴포넌트 폭 (96dpi 기준)
const A4_H_PX = 1122; // 컴포넌트 높이

// html2canvas 캡처 해상도 배수. 2 = 인쇄 충분, 3 = 더 선명(파일 크기 ↑).
const CAPTURE_SCALE = 2;

// jsPDF A4 mm 크기.
const A4_W_MM = 210;
const A4_H_MM = 297;

async function awaitFontsReady() {
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }
  // Pretendard / Noto Sans KR 동적 로드 대기 안전망 — 한 프레임 더.
  await new Promise(r => requestAnimationFrame(() => r()));
  await new Promise(r => requestAnimationFrame(() => r()));
}

async function mountTemplateAndCapture(Component, props) {
  const [{ default: html2canvas }, { jsPDF }, ReactDOM, React] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
    import("react-dom/client"),
    import("react"),
  ]);

  // offscreen container
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width  = `${A4_W_PX}px`;
  host.style.height = `${A4_H_PX}px`;
  host.style.background = "#FFFFFF";
  host.style.zIndex = "-1";
  document.body.appendChild(host);

  const root = ReactDOM.createRoot(host);
  try {
    root.render(React.createElement(Component, props));

    // 렌더 + 폰트 안정화 대기
    await new Promise(r => setTimeout(r, 50));
    await awaitFontsReady();
    await new Promise(r => setTimeout(r, 30));

    const canvas = await html2canvas(host, {
      scale: CAPTURE_SCALE,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false,
      // 한글 텍스트 정렬 안정 — letterRendering 옵션 (구버전 호환).
      letterRendering: true,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", 0, 0, A4_W_MM, A4_H_MM, undefined, "FAST");

    const blob = pdf.output("blob");
    return blob;
  } finally {
    try { root.unmount(); } catch (_) {}
    try { document.body.removeChild(host); } catch (_) {}
  }
}

// ============================================================
// 외부 API — 부모는 다음 함수만 호출.
// ============================================================

export async function renderInvoicePdf(props) {
  const { default: InvoiceTemplate } = await import("../components/admin/docs/InvoiceTemplate.jsx");
  return mountTemplateAndCapture(InvoiceTemplate, props);
}

export async function renderReceiptPdf(props) {
  const { default: ReceiptTemplate } = await import("../components/admin/docs/ReceiptTemplate.jsx");
  return mountTemplateAndCapture(ReceiptTemplate, props);
}

// Blob → File (Web Share API 요구). 파일명 일자 + 일련번호 결합.
export function blobToPdfFile(blob, filename) {
  // File 생성자 미지원 환경 폴백 (대부분 안전): Blob 그대로 반환하면 share files 실패 가능.
  try {
    return new File([blob], filename, { type: "application/pdf" });
  } catch (_) {
    return blob;
  }
}

// Web Share 시도 + 미지원 시 false 반환 (부모가 fallback).
export async function tryShareFiles({ title, text, file }) {
  if (typeof navigator === "undefined") return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ title, text, files: [file] });
    return true;
  } catch (err) {
    // 사용자가 공유 시트 취소 → AbortError. 그래도 false 반환해 폴백 실행 X.
    if (err && err.name === "AbortError") return true;
    console.error("[docIssueRender.tryShareFiles]", err);
    return false;
  }
}

// 다운로드 — PWA standalone iOS 는 download attribute 제한 → window.open 폴백.
export function downloadOrOpenBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // standalone iOS 감지 → 새 탭 강제.
    const isIosStandalone =
      typeof window !== "undefined"
      && window.navigator
      && window.navigator.standalone === true;
    if (isIosStandalone) {
      window.open(url, "_blank");
    } else {
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } finally {
    // 약간 지연 후 revoke (다운로드 트리거 보장).
    setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
  }
}

// 일련번호 자동 생성 — YYMMDD-RRR (랜덤 3자리, 발행 이력 미구현 단계 잠정).
//   Step 3 (발행 이력) 단계에서 DB 시퀀스로 대체 예정.
export function generateSerialNo() {
  const d = new Date();
  const fmtPart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "2-digit", month: "2-digit", day: "2-digit",
  }).format(d);
  const ymd = fmtPart.replace(/-/g, "");
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `${ymd}-${rand}`;
}
