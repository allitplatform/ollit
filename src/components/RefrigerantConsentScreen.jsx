// ============================================
// RefrigerantConsentScreen — 냉매 충전 동의서 (기사 PWA)
// 2026-05-22 — Phase 1
//
// 흐름:
//   1) 기사 PWA 작업 상세 → [📝 냉매 충전 동의서] 클릭
//   2) 본 화면 — 동의서 문구 + 고객 성함 + 서명 캔버스
//   3) [동의 완료] → uploadPhoto(step="consent_sign") + saveConsentAdapter
//   4) 부모 콜백 onComplete() → 작업 상세 복귀 → [작업 시작] 활성화
//
//   [동의 거부 — 출장비만] → 부모 콜백 onReject() → visitOnly subScreen 진입
//     · Phase 2에서 visit_only 정산 정상화. 본 Phase는 라우팅만.
//
// 저장:
//   · 서명 이미지 = photos 테이블 step="consent_sign" row (Storage 측 PNG)
//   · 메타(성함/시각) = tasks.category_data.consent jsonb
// ============================================

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Check, X } from "lucide-react";
import { uploadPhoto } from "../lib/photosDb.js";
import { saveConsentAdapter } from "../data/tasksDb.js";

// 2026-06-03 — Phase 1 보강: add-on(세척+냉매충전 2-task) 컨텍스트 측측 prop 2개 추가.
//   skipAutoSave=true → 측측 측측 measure 측측 (부모 측측). onComplete 측측 signatureBlob 측측.
//   rejectMode="cancel" → 거부 버튼 = "측측 — 측측" (출장비만 X). 기본/일반 냉매 동작 측측.
// 2026-07-14 — kind prop 추가 (사장님 spec: 누수/누설 시공에도 동의서).
//   kind="refrigerant"(기본): 기존 냉매 문구 그대로.
//   kind="leak": 1단계 시공 종류 선택 ([부위 수리] / [누설차단제]) → 해당 문구만 표시 → 서명.
//   저장 시 consent.type 에 어떤 문구에 서명했는지 기록 ("leak_repair" | "leak_sealant").

// 누설 동의서 문구 (2026-07-14 사장님 제공 원문)
const LEAK_TEXTS = {
  leak_repair: {
    title: "누설 부위 수리 동의",
    pick:  "🔧 부위 수리",
    pickDesc: "누설 부위를 찾아 수리한 경우",
    items: [
      "업체는 금번 수리한 부위에 한하여 시공일로부터 1년간 무상 A/S를 보장합니다.",
      "수리하지 않은 다른 부위에서 누설 또는 고장이 발생할 수 있으며, 이에 따른 수리 및 냉매 충전 비용은 별도로 발생할 수 있음을 확인합니다.",
      "수리하지 않은 다른 부위의 누설 및 고장에 대해서는 환불이나 무상 재시공을 요구하지 않으며, 이에 대해 이의를 제기하지 않습니다.",
      "시공 후 냉난방 상태를 확인하였으며 정상 작동됨을 확인합니다.",
    ],
  },
  leak_sealant: {
    title: "누설차단제 시공 동의",
    pick:  "🧪 누설차단제",
    pickDesc: "차단제(약품)를 주입한 경우",
    items: [
      "본인은 에어컨 누설차단제 시공에 대해 충분한 설명을 듣고 아래 사항에 동의합니다.",
      "누설차단제는 미세 누설 보조용 시공이며, 모든 누설을 완벽하게 차단하는 것은 아닙니다.",
      "누설 상태에 따라 효과가 없거나 냉매(가스)가 다시 부족해질 수 있음을 확인합니다.",
      "냉매가 재차 부족할 경우 별도의 누설 수리 및 냉매 충전 비용이 발생할 수 있으며, 본인은 누설차단제 시공 비용에 대한 환불이나 무상 재시공을 요구하지 않고 이에 이의를 제기하지 않습니다.",
      "시공 후 냉난방 상태를 확인하였으며 정상 작동됨을 확인합니다.",
    ],
  },
  // 2026-07-14 — 누수(물샘)는 냉매 누설과 다른 시공 (사장님 지적).
  //   무상 A/S 기간 명시 없음 (사장님 결정). 문구는 초안 승인분 — 추후 수정 예정.
  water_leak: {
    title: "누수(물샘) 수리 동의",
    pick:  "💧 누수(물샘) 수리",
    pickDesc: "물이 새서 배수·설치 등을 조치한 경우",
    items: [
      "본인은 에어컨 누수(물샘) 수리 시공에 대해 충분한 설명을 듣고 아래 사항에 동의합니다.",
      "누수의 원인은 배수(드레인) 막힘, 설치 구배 불량, 결로, 배관 보온 불량 등 다양하며, 금번 시공은 현장에서 확인된 원인에 대한 조치입니다.",
      "조치한 부위 외 다른 원인으로 누수가 재발할 수 있으며, 이 경우 수리 비용은 별도로 발생할 수 있음을 확인합니다.",
      "사용 환경(먼지·곰팡이·배수 막힘 재발 등)으로 인한 재발은 무상 A/S 대상이 아니며, 이에 대해 환불이나 무상 재시공을 요구하지 않으며 이의를 제기하지 않습니다.",
      "시공 후 정상 배수 및 작동 상태를 확인하였습니다.",
    ],
  },
};

export default function RefrigerantConsentScreen({ task, onBack, onComplete, onReject, skipAutoSave = false, rejectMode = "visit_only", kind = "refrigerant" }) {
  const [customerName, setCustomerName] = useState("");
  const [hasStroke, setHasStroke]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  // 2026-08-03 — 사장님 확정: 냉매로 들어온 건도 현장에서 누설 수리를 할 수 있고,
  //   누설로 들어온 건도 충전만 할 수 있다 (이알음 A-260802-082 사례).
  //   → 접수 종목과 무관하게 1단계에서 동의서 종류를 고른다:
  //     냉매 충전 / 부위 수리 / 누설차단제 / 누수(물샘). 순서만 접수 종목 따라 다름.
  //   docType(구 leakType): null = 선택 화면, "refrigerant" | LEAK_TEXTS 키.
  //   add-on(세척+냉매, skipAutoSave) 흐름은 냉매 충전 고정 — 선택 화면 생략.
  // 2026-08-03 (2차) — 사장님 확정: 복수 선택. 충전+차단제, 충전+부위수리처럼
  //   한 방문에 여러 시공을 하는 경우가 실재 → 체크박스로 여러 개 고르고,
  //   고른 문구를 한 화면에 이어 붙여 서명은 한 번만 받는다.
  //   consent.type 은 "refrigerant+leak_sealant" 처럼 + 로 조합 기록.
  const [docTypes, setDocTypes] = useState(skipAutoSave ? ["refrigerant"] : []);
  const [stage, setStage] = useState(skipAutoSave ? "doc" : "pick");
  const isLeak = kind === "leak";
  const canvasRef = useRef(null);
  const drawing   = useRef(false);

  // ──────────────── 캔버스 setup + 그리기 핸들러 ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 디바이스 픽셀 비율 대응 — 또렷한 선 보장
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = "#111";

    function pointFrom(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches?.[0] || e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    }
    function start(e) {
      drawing.current = true;
      const { x, y } = pointFrom(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    function move(e) {
      if (!drawing.current) return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = pointFrom(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (!hasStroke) setHasStroke(true);
    }
    function end() {
      drawing.current = false;
    }

    canvas.addEventListener("touchstart", start, { passive: true });
    canvas.addEventListener("touchmove",  move,  { passive: false });
    canvas.addEventListener("touchend",   end);
    canvas.addEventListener("touchcancel", end);
    canvas.addEventListener("mousedown",  start);
    canvas.addEventListener("mousemove",  move);
    canvas.addEventListener("mouseup",    end);
    canvas.addEventListener("mouseleave", end);

    return () => {
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove",  move);
      canvas.removeEventListener("touchend",   end);
      canvas.removeEventListener("touchcancel", end);
      canvas.removeEventListener("mousedown",  start);
      canvas.removeEventListener("mousemove",  move);
      canvas.removeEventListener("mouseup",    end);
      canvas.removeEventListener("mouseleave", end);
    };
    // 2026-07-14 — 시공 종류 선택 후에야 캔버스가 mount 되므로 stage 의존.
    //   (기존 [] 이면 선택 화면에서 effect 가 소진돼 서명 핸들러가 안 붙음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  // ──────────────── 동의 완료 ────────────────
  async function handleSubmit() {
    if (submitting) return;
    const name = customerName.trim();
    if (!name) {
      alert("고객 성함을 입력해 주세요.");
      return;
    }
    if (!hasStroke) {
      alert("서명을 그려 주세요.");
      return;
    }
    if (!task?.id) {
      alert("작업 정보가 없습니다.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) 캔버스 → PNG Blob → File
      const blob = await new Promise((res) =>
        canvasRef.current.toBlob(res, "image/png")
      );
      if (!blob) {
        alert("서명 이미지 변환 실패");
        return;
      }
      const file = new File([blob], `consent_${task.id}.png`, { type: "image/png" });

      // 2026-07-14 — 동의 문구 종류. 2026-08-03 (2차) — 복수 선택 조합을 + 로 기록.
      const consentType = (selectedDocs.length ? selectedDocs : ["refrigerant"]).join("+");

      // 2026-06-03 — skipAutoSave 분기: 측측 측측 measure 측측, 측측 측측 측측 측측 (Phase 1 add-on 측측).
      if (skipAutoSave) {
        if (typeof onComplete === "function") {
          onComplete({ customerName: name, signatureBlob: file, type: consentType });
        }
        return;
      }

      // 2) photos 업로드 (step="consent_sign")
      const up = await uploadPhoto(task.id, file, "consent_sign");
      if (!up?.ok || !up?.url) {
        alert(`서명 업로드 실패: ${up?.error || "unknown"}`);
        return;
      }

      // 3) tasks.category_data.consent 머지
      const save = await saveConsentAdapter(task.id, {
        customerName: name,
        signatureUrl: up.url,
        type: consentType,
      });
      if (!save?.ok) {
        alert(`동의서 저장 실패: ${save?.error || "unknown"}`);
        return;
      }

      // 4) 부모 콜백
      if (typeof onComplete === "function") {
        onComplete({
          customerName: name,
          signatureUrl: up.url,
          signedAt: save.task?.consent?.signedAt || new Date().toISOString(),
          type: consentType,
        });
      }
    } catch (e) {
      console.error("[RefrigerantConsent] 예외:", e);
      alert(`동의서 처리 예외: ${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReject() {
    // 2026-06-03 — rejectMode 분기: "cancel" = 측측 측측 측측, "visit_only" = 측측 측측 (기존).
    if (rejectMode === "cancel") {
      if (typeof onReject === "function") onReject();
      return;
    }
    const ok = window.confirm(
      "고객이 동의를 거부했나요?\n\n" +
      "[확인]을 누르면 출장비 처리 화면으로 이동합니다.\n" +
      "작업은 진행되지 않으며 출장비만 청구됩니다."
    );
    if (!ok) return;
    if (typeof onReject === "function") onReject();
  }

  // ──────────────── 1단계 — 동의서 종류 선택 (냉매·누설 공통, 2026-08-03) ────────────────
  //   접수 종목은 "순서"만 정한다: 냉매 건은 냉매 충전이 맨 위, 누설 건은 수리류가 먼저.
  const REFRI_PICK = {
    key: "refrigerant",
    pick: "❄️ 냉매 충전",
    pickDesc: "냉매(가스)를 충전한 경우",
    title: "냉매 가스 충전 서비스 동의",
  };
  const pickOrder = isLeak
    ? ["leak_repair", "leak_sealant", "water_leak", "refrigerant"]
    : ["refrigerant", "leak_repair", "leak_sealant", "water_leak"];

  // 정렬은 pickOrder 기준 고정 — 화면·기록 순서가 사람마다 달라지지 않게.
  const selectedDocs = pickOrder.filter((k) => docTypes.includes(k));

  function toggleDoc(key) {
    setDocTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  if (stage === "pick") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 40 }}>
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--bg-secondary)",
        }}>
          <button
            onClick={onBack}
            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--text-primary)", display: "flex" }}
          >
            <ArrowLeft size={18}/>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
              📋 시공 동의서
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              {task?.customer || "고객"} · 오늘 하신 시공을 모두 선택해 주세요
            </div>
          </div>
        </div>

        <div style={{ margin: "18px 16px 10px", display: "flex", flexDirection: "column", gap: 12 }}>
          {pickOrder.map((key) => {
            const doc = key === "refrigerant" ? REFRI_PICK : LEAK_TEXTS[key];
            const on = docTypes.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleDoc(key)}
                style={{
                  width: "100%", padding: "18px 16px",
                  background: on ? "rgba(255,27,141,0.06)" : "var(--bg-secondary)",
                  border: on ? "1.5px solid var(--accent, #FF1B8D)" : "1.5px solid var(--border-color)",
                  borderRadius: 14,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  display: "flex", alignItems: "flex-start", gap: 12,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  border: on ? "2px solid var(--accent, #FF1B8D)" : "2px solid var(--border-color)",
                  background: on ? "var(--accent, #FF1B8D)" : "transparent",
                  color: "#fff", fontSize: 14, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{on ? "✓" : ""}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                    {doc.pick}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {doc.pickDesc} → {doc.title}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ margin: "0 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6, margin: "0 2px 12px" }}>
            오늘 실제로 한 시공을 <b>모두</b> 체크하세요. 고른 동의서가 다음 화면에 이어서
            표시되고, 서명은 한 번만 받습니다.
          </div>
          <button
            onClick={() => selectedDocs.length && setStage("doc")}
            disabled={selectedDocs.length === 0}
            style={{
              width: "100%", padding: "15px",
              background: selectedDocs.length ? "var(--accent, #FF1B8D)" : "var(--bg-tertiary, var(--bg-secondary))",
              color: selectedDocs.length ? "#fff" : "var(--text-tertiary)",
              border: "none", borderRadius: 13,
              fontSize: 14.5, fontWeight: 800, fontFamily: "inherit",
              cursor: selectedDocs.length ? "pointer" : "not-allowed",
            }}
          >
            {selectedDocs.length
              ? `선택한 동의서로 진행 (${selectedDocs.length}건) →`
              : "시공을 하나 이상 선택하세요"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border-color)",
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--bg-secondary)",
      }}>
        <button
          onClick={skipAutoSave ? onBack : () => setStage("pick")}
          style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--text-primary)", display: "flex" }}
        >
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
            {selectedDocs.length > 1
              ? `📋 시공 동의 (${selectedDocs.length}건)`
              : selectedDocs[0] === "refrigerant"
                ? "📋 냉매 가스 충전 서비스 동의"
                : `📋 ${LEAK_TEXTS[selectedDocs[0]]?.title || "시공 동의"}`}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
            {task?.customer || "고객"} · {selectedDocs
              .map((k) => (k === "refrigerant" ? "냉매 충전" : LEAK_TEXTS[k]?.title.replace(" 동의", "")))
              .join(" + ")}
          </div>
        </div>
      </div>

      {/* 2026-08-03 (2차) — 고른 동의서를 순서대로 이어 붙인다 (n/m 표시).
            서명은 맨 아래 한 번 — 한 서명이 표시된 모든 문구에 대한 동의. */}
      {selectedDocs.map((docKey, di) => {
        const badge = selectedDocs.length > 1 ? `${di + 1} / ${selectedDocs.length}` : null;
        const badgeEl = badge && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: "var(--accent, #FF1B8D)",
            background: "rgba(255,27,141,0.08)", borderRadius: 999,
            padding: "2px 8px", marginRight: 8, verticalAlign: "2px",
          }}>{badge}</span>
        );

        if (docKey === "refrigerant") {
          // 냉매 충전 (2026-08-03 사장님 확정 개정판).
          //   핵심: 점검 여부와 무관하게 누설 "수리"를 안 하면 다시 빠질 수 있고,
          //   심하면 충전 당일 몇 시간 이내에도 빠질 수 있음을 명시.
          return (
            <div key={docKey} style={{
              margin: "14px 16px",
              padding: "16px 16px 18px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
            }}>
              <div style={{
                fontWeight: 800, marginBottom: 10, paddingBottom: 10,
                borderBottom: "1px solid var(--border-color)",
              }}>{badgeEl}냉매 가스 충전 서비스 동의</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>[본 서비스 안내]</div>
              <div>
                본 서비스는 에어컨 냉매(가스)를 충전하는 작업입니다. 냉매는 저절로 소모되지
                않으며, 부족하다는 것은 어딘가에서 새고 있다는 뜻입니다.
              </div>

              <div style={{ fontWeight: 700, marginTop: 12, marginBottom: 6 }}>[안내 말씀]</div>
              <div>
                <b>1.</b> 누설 점검을 했더라도, 누설 부위를 <b>수리하지 않고</b> 충전하는 경우
                충전한 냉매는 다시 빠질 수 있습니다.
              </div>
              <div style={{ marginTop: 12 }}>
                <b>2.</b> 누설이 심한 경우 <b>충전 당일, 몇 시간 이내에도</b> 냉매가 모두
                빠질 수 있음을 확인합니다.
              </div>
              <div style={{ marginTop: 12 }}>
                <b>3.</b> 압축기(컴프레서) 고장, 배관 부식 등 기계 자체 결함이 있는 경우에도
                충전 후 1~3일 이내 다시 빠질 수 있습니다.
              </div>
              <div style={{ marginTop: 12 }}>
                <b>4.</b> 위 사유로 인한 재누설은 충전 작업의 불량이 아니므로,
                재방문·재충전·환불은 제공되지 않습니다. 근본 해결은 누설 부위 수리 또는
                기계 A/S·교체입니다.
              </div>
              <div style={{ marginTop: 12 }}>
                <b>5.</b> 시공 직후 냉방(난방)이 정상 작동됨을 확인하였습니다.
              </div>

              <div style={{
                marginTop: 14, padding: "10px 12px",
                background: "rgba(255,184,0,0.10)",
                border: "1px solid rgba(255,184,0,0.30)",
                borderRadius: 8, fontWeight: 700,
              }}>
                위 내용을 충분히 안내받았으며, 이에 동의합니다.
              </div>
            </div>
          );
        }

        const leakDoc = LEAK_TEXTS[docKey];
        if (!leakDoc) return null;
        return (
          <div key={docKey} style={{
            margin: "14px 16px",
            padding: "16px 16px 18px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)",
          }}>
            <div style={{
              fontWeight: 800, marginBottom: 10, paddingBottom: 10,
              borderBottom: "1px solid var(--border-color)",
            }}>{badgeEl}{leakDoc.title}</div>
            {leakDoc.items.map((txt, i) => (
              <div key={i} style={{ marginTop: i === 0 ? 0 : 12 }}>
                <b>{i + 1}.</b> {txt}
              </div>
            ))}
            <div style={{
              marginTop: 14, padding: "10px 12px",
              background: "rgba(255,184,0,0.10)",
              border: "1px solid rgba(255,184,0,0.30)",
              borderRadius: 8, fontWeight: 700,
            }}>
              위 내용을 충분히 이해하고 이에 동의합니다.
            </div>
          </div>
        );
      })}

      {/* 고객 성함 입력 */}
      <div style={{ margin: "0 16px 14px" }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          고객 성함 <span style={{ color: "#FF3B5C" }}>*</span>
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="예: 홍길동"
          style={{
            width: "100%", padding: "11px 12px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: 9,
            fontSize: 15, color: "var(--text-primary)",
            fontFamily: "inherit", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* 서명 캔버스 */}
      <div style={{ margin: "0 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            서명 <span style={{ color: "#FF3B5C" }}>*</span>
            {selectedDocs.length > 1 && (
              <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}>
                {" "}— 위 {selectedDocs.length}건의 동의서에 대한 서명입니다
              </span>
            )}
          </label>
          <div style={{ flex: 1 }}/>
          <button
            type="button"
            onClick={clearCanvas}
            style={{
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              color: "var(--text-secondary)",
              cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <RotateCcw size={11}/> 지우기
          </button>
        </div>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%", height: 160,
            background: "#fff",
            border: "1.5px dashed #999",
            borderRadius: 9,
            display: "block",
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6 }}>
          손가락 또는 마우스로 사각형 안에 서명해 주세요
        </div>
      </div>

      {/* 액션 버튼 */}
      <div style={{ margin: "20px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%", padding: 16,
            background: submitting ? "var(--bg-tertiary)" : "#0F6E56",
            border: "none", borderRadius: 14,
            color: submitting ? "var(--text-tertiary)" : "#fff",
            fontSize: 16, fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Check size={16}/>
          {submitting ? "저장 중..." : selectedDocs.length > 1 ? `동의 완료 (${selectedDocs.length}건 서명)` : "동의 완료"}
        </button>

        <button
          onClick={handleReject}
          disabled={submitting}
          style={{
            width: "100%", padding: 13,
            background: "transparent",
            border: "1px solid rgba(192,57,43,0.45)",
            borderRadius: 12,
            color: "#FF3B5C",
            fontSize: 13, fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <X size={13}/>
          {rejectMode === "cancel" ? "취소 — 뒤로" : "동의 거부 — 출장비만"}
        </button>
      </div>
    </div>
  );
}
