// 2026-06-19 Step 4 — 거래명세서 / 영수증 PDF·PNG 렌더링 + 공유 헬퍼.
//
// 2026-06-19 보강:
//   · canvas 캡처 1번 → PNG (canvas.toBlob) + PDF (jspdf.addImage) 둘 다 출력
//   · jsPDF 는 PDF 가 실제 필요할 때만 dynamic import (PNG 만 쓰는 경우 미로드)
//   · 카톡 공유는 부모가 PNG 우선 시도 → 실패 시 PDF → 실패 시 다운로드 폴백
//
// 흐름:
//   1) offscreen container (position:fixed, left:-10000px) 생성
//   2) React 양식 컴포넌트 mount (createRoot)
//   3) document.fonts.ready 대기 + 2 RAF 대기 (폰트 안정화)
//   4) html2canvas scale 2 캡처 → canvas 반환
//   5) 부모가 canvasToPdfBlob / canvasToPngBlob 호출
//
// 라이브러리·양식 모두 dynamic import — vite 자동 chunk 분리.

const A4_W_PX = 793;
const A4_H_PX = 1122;
const CAPTURE_SCALE = 2;
const A4_W_MM = 210;
const A4_H_MM = 297;

async function awaitFontsReady() {
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }
  await new Promise(r => requestAnimationFrame(() => r()));
  await new Promise(r => requestAnimationFrame(() => r()));
}

async function mountTemplateAndCaptureCanvas(Component, props) {
  const [{ default: html2canvas }, ReactDOM, React] = await Promise.all([
    import("html2canvas"),
    import("react-dom/client"),
    import("react"),
  ]);

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

    await new Promise(r => setTimeout(r, 50));
    await awaitFontsReady();
    await new Promise(r => setTimeout(r, 30));

    const canvas = await html2canvas(host, {
      scale: CAPTURE_SCALE,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false,
      letterRendering: true,
    });

    return canvas;
  } finally {
    try { root.unmount(); } catch (_) {}
    try { document.body.removeChild(host); } catch (_) {}
  }
}

// ============================================================
// 외부 API — 부모가 호출하는 함수들.
// ============================================================

export async function renderInvoiceCanvas(props) {
  const { default: InvoiceTemplate } = await import("../components/admin/docs/InvoiceTemplate.jsx");
  return mountTemplateAndCaptureCanvas(InvoiceTemplate, props);
}

export async function renderReceiptCanvas(props) {
  const { default: ReceiptTemplate } = await import("../components/admin/docs/ReceiptTemplate.jsx");
  return mountTemplateAndCaptureCanvas(ReceiptTemplate, props);
}

// canvas → PDF Blob. jsPDF dynamic import (PDF 필요할 때만).
export async function canvasToPdfBlob(canvas) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(dataUrl, "JPEG", 0, 0, A4_W_MM, A4_H_MM, undefined, "FAST");
  return pdf.output("blob");
}

// canvas → PNG Blob (벡터 텍스트는 아니지만 카톡 첨부용으로 충분).
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob 실패"));
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}

// Blob → File (Web Share files API 요구).
export function blobToFile(blob, filename, mime) {
  try {
    return new File([blob], filename, { type: mime || blob.type });
  } catch (_) {
    return blob;
  }
}

// Web Share files 시도. 미지원/실패 시 false (부모 폴백).
//   AbortError(사용자 취소) 는 true 반환 — 사용자 의도로 닫혔으니 폴백 X.
export async function tryShareFiles({ title, text, file }) {
  if (typeof navigator === "undefined") return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ title, text, files: [file] });
    return true;
  } catch (err) {
    if (err && err.name === "AbortError") return true;
    console.error("[docIssueRender.tryShareFiles]", err);
    return false;
  }
}

// 다운로드 — PWA standalone iOS download attribute 제한 → window.open 폴백.
export function downloadOrOpenBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const isIosStandalone =
      typeof window !== "undefined"
      && window.navigator
      && window.navigator.standalone === true;
    if (isIosStandalone) {
      window.open(url, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
  }
}

// 일련번호 — YYMMDD-RRR (실제 발행일 KST 기준, 사용자 입력 일자와 무관).
//   Step 3 (발행 이력) 단계에서 DB 시퀀스로 교체 예정.
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
