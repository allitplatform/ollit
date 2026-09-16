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
  // 누설 모드 — 시공 종류 (null = 선택 화면)
  const [leakType, setLeakType] = useState(null);
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
    // 2026-07-14 — 누설 모드: 시공 종류 선택 후에야 캔버스가 mount 되므로 leakType 의존.
    //   (기존 [] 이면 선택 화면에서 effect 가 소진돼 서명 핸들러가 안 붙음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leakType]);

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

      // 2026-07-14 — 동의 문구 종류 (냉매 / 누설 부위수리 / 누설차단제)
      const consentType = isLeak ? leakType : "refrigerant";

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

  // ──────────────── 누설 모드 1단계 — 시공 종류 선택 ────────────────
  if (isLeak && !leakType) {
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
              📋 누수/누설 시공 동의
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              {task?.customer || "고객"} · 오늘 하신 시공을 선택해 주세요
            </div>
          </div>
        </div>

        <div style={{ margin: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {["leak_repair", "leak_sealant", "water_leak"].map((key) => (
            <button
              key={key}
              onClick={() => setLeakType(key)}
              style={{
                width: "100%", padding: "20px 18px",
                background: "var(--bg-secondary)",
                border: "1.5px solid var(--border-color)",
                borderRadius: 14,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                {LEAK_TEXTS[key].pick}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {LEAK_TEXTS[key].pickDesc} → {LEAK_TEXTS[key].title}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const leakDoc = isLeak ? LEAK_TEXTS[leakType] : null;

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
          onClick={isLeak ? () => setLeakType(null) : onBack}
          style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--text-primary)", display: "flex" }}
        >
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
            {isLeak ? `📋 ${leakDoc.title}` : "📋 냉매 가스 충전 서비스 동의"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
            {task?.customer || "고객"} · {isLeak ? "누수/누설 시공" : (task?.workType || "냉매충전")}
          </div>
        </div>
      </div>

      {/* 동의서 문구 — 누설: 사장님 제공 조항 리스트 */}
      {isLeak && (
        <div style={{
          margin: "14px 16px",
          padding: "16px 16px 18px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)",
        }}>
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
      )}

      {/* 동의서 문구 — 냉매 (기존) */}
      {!isLeak && (
      <div style={{
        margin: "14px 16px",
        padding: "16px 16px 18px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 12,
        fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)",
        whiteSpace: "pre-wrap",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>[본 서비스 안내]</div>
        <div>
          본 서비스는 에어컨 냉매 가스를 정상적으로 충전하는 작업입니다.
        </div>

        <div style={{ fontWeight: 700, marginTop: 12, marginBottom: 6 }}>[안내 말씀]</div>
        <div>
          충전 서비스는 정상적으로 이행됩니다. 다만 에어컨 기계 자체에 결함이 있는 경우,
          충전된 냉매가 다시 누설될 수 있습니다.
        </div>

        <div style={{ marginTop: 12 }}>
          다음의 기계 결함이 있으면 충전 후 1~3일 이내에 냉매가 다시 빠질 수 있습니다:
        </div>
        <ul style={{ margin: "6px 0 0 0", paddingLeft: 22 }}>
          <li>컴프레서(압축기) 고장으로 인한 누설</li>
          <li>배관 등 부품의 누설</li>
          <li>누설 부위가 큰 경우</li>
        </ul>

        <div style={{ marginTop: 12 }}>
          이는 충전 작업의 불량이 아니라 제품 자체의 결함이며, 재충전으로 해결되지 않습니다.
          근본 해결은 해당 부위의 A/S 또는 기계 교체가 필요하며, 재방문·재충전은
          제공되지 않습니다.
        </div>

        <div style={{ marginTop: 12 }}>
          또한, 수리한 누설 부위 외에 다른 부위에서 새로 누설이 발생하더라도
          이는 본 서비스의 책임 범위에 해당하지 않습니다.
          수리 서비스는 정상적으로 이행되었습니다.
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
      )}

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
          {submitting ? "저장 중..." : "동의 완료"}
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
