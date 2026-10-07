// 2026-10-07 — 기사 앱 위쪽 카드: 항목이 여러 개일 때 "🛠 이전설치" 한 줄 + 칩 [철거 ×1] [설치 ×1] + 오른쪽 고객 견적.
//   새 배정 상세 · 작업 화면이 같이 쓴다. 금액은 고객 견적(고객에게 받을 돈)만 — 기사 몫은 여기에 적지 않는다.
import { isRelocationTask } from "../../utils/relocation.js";
import { workItemName } from "../../utils/workItemName.js";
import { getCategoryMeta } from "../../lib/serviceCatalog.js";

export function ItemChipsHeader({ task, liveItems = [], showQuote = true }) {
  const reloc = isRelocationTask(task);
  const meta = getCategoryMeta(task);
  const est = Number(task.estimateTotal || 0);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{meta.icon} {reloc ? "이전설치" : meta.label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {liveItems.map((w, i) => {
            let nm = workItemName(w, "");
            if (reloc && nm === "이전설치") nm = "설치";
            return (
              <span key={w.id || i} style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {nm || "항목"} ×{w.qty || 1}
              </span>
            );
          })}
        </div>
      </div>
      {showQuote && est > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>고객 견적</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{est.toLocaleString("ko-KR")}원</div>
        </div>
      )}
    </div>
  );
}

export default ItemChipsHeader;
