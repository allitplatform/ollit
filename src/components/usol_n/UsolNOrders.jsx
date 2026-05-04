// V11-2 — 유솔 N · 새 접수 탭
// 접수 CSV 업로드 → 자동 분류 → 일괄 등록 → 묶음 카드 표시
import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  csvOrderRowToTask,
} from "../../data/usolNOrderCsv.js";
import {
  loadTasks, saveTasks, findTaskByProductOrderId,
} from "../../data/tasks.js";

export function UsolNOrders() {
  const [tasksVersion, setTasksVersion] = useState(0);
  const [pendingRows, setPendingRows] = useState([]);
  const fileInputRef = useRef(null);

  const tasks = useMemo(
    () => loadTasks().filter(t => t.principalId === "usol_n" && t.status === "received"),
    [tasksVersion]
  );

  function refresh() { setTasksVersion(v => v + 1); }

  // CSV 업로드 → 파싱 → 중복 제거 → 미리보기
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb   = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const newRows = rows.filter(row => {
          const productOrderId = row["상품주문번호"];
          return productOrderId && !findTaskByProductOrderId(productOrderId);
        });
        setPendingRows(newRows);
      } catch (err) {
        console.error("[UsolNOrders.parse]", err);
        alert("CSV 파싱 실패: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleConfirmImport() {
    const all = loadTasks();
    pendingRows.forEach(row => {
      const t = csvOrderRowToTask(row);
      if (t.productOrderId) t.id = `usol_n_${t.productOrderId}`;
      all.push(t);
    });
    saveTasks(all);
    setPendingRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refresh();
  }

  function handleCancel() {
    setPendingRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // 같은 주문번호 묶음
  const grouped = useMemo(() => {
    const m = {};
    tasks.forEach(t => {
      const key = t.orderNumber || t.id;
      if (!m[key]) m[key] = [];
      m[key].push(t);
    });
    return m;
  }, [tasks]);

  return (
    <div>
      <UploadBox
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        pendingCount={pendingRows.length}
        onConfirm={handleConfirmImport}
        onCancel={handleCancel}
      />

      <div style={sectionTitleStyle}>
        접수 대기 <span style={{ color: "#03C75A", fontWeight: 700 }}>{Object.keys(grouped).length}</span>건
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Empty>대기 중인 새 접수가 없습니다</Empty>
      ) : (
        Object.entries(grouped).map(([orderNumber, items]) => (
          <OrderGroupCard key={orderNumber} items={items}/>
        ))
      )}
    </div>
  );
}

function UploadBox({ fileInputRef, onFileSelect, pendingCount, onConfirm, onCancel }) {
  if (pendingCount > 0) {
    return (
      <div style={uploadConfirmStyle}>
        <div style={{ fontSize: 13, color: "#03C75A", fontWeight: 700, marginBottom: 6 }}>
          📥 신규 접수 {pendingCount}건 발견
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>
          이미 등록된 작업은 자동 제외했습니다
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onConfirm} style={primaryButtonStyle}>
            {pendingCount}건 일괄 등록
          </button>
          <button onClick={onCancel} style={secondaryButtonStyle}>취소</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={uploadDropStyle}
      onClick={() => fileInputRef.current?.click()}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>📤</div>
      <div style={{ fontSize: 13, color: "#03C75A", fontWeight: 600 }}>
        접수 CSV 업로드
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
        네이버 발주 엑셀 파일을 선택하세요
      </div>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        onChange={onFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}

function OrderGroupCard({ items }) {
  const totalNet = items.reduce((s, t) => s + (t.netAmount || 0), 0);
  const isGroup = items.length > 1;
  const first   = items[0];

  return (
    <div style={isGroup ? cardGroupStyle : cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {first.customer || "—"}
          </span>
          <span style={statusBadgeStyle}>접수</span>
          {isGroup && <span style={groupBadgeStyle}>묶음 {items.length}</span>}
        </div>
        <span style={{ fontSize: 13, color: "#03C75A", fontWeight: 700, fontFamily: "inherit" }}>
          ₩{totalNet.toLocaleString()}
        </span>
      </div>

      {first.address && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
          {String(first.address).split("(")[0].trim()}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
        {items.map((t, idx) => {
          const wi = Array.isArray(t.workItems) && t.workItems.length > 0 ? t.workItems[0] : null;
          const type = t.orderType === "extra"
            ? (t.appliance || "추가")
            : (wi?.type || t.appliance || "?");
          const isExtra = t.orderType === "extra";
          return (
            <span key={idx} style={{
              fontSize: 9,
              color: isExtra ? "#F59E0B" : "#03C75A",
              background: isExtra ? "rgba(245,158,11,0.10)" : "rgba(3,199,90,0.10)",
              padding: "2px 6px", borderRadius: 4, fontWeight: 600,
            }}>
              {type} ×{t.qty || 1}
            </span>
          );
        })}
      </div>

      {first.buyerName && first.buyerName !== first.customer && (
        <div style={{ fontSize: 9, color: "#A855F7", marginTop: 4 }}>
          ⚠️ 구매자: {first.buyerName} (수취인 다름)
        </div>
      )}

      {first.paidAt && (
        <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4 }}>
          {new Date(first.paidAt).toLocaleDateString("ko-KR")} 결제 · {first.phone || "—"}
        </div>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const sectionTitleStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 8, paddingLeft: 4, marginTop: 16,
};

const uploadDropStyle = {
  padding: 16,
  background: "rgba(3,199,90,0.06)",
  border: "1px dashed rgba(3,199,90,0.4)",
  borderRadius: 10, textAlign: "center", cursor: "pointer",
  marginBottom: 16,
};

const uploadConfirmStyle = {
  padding: 14,
  background: "rgba(3,199,90,0.12)",
  border: "1px solid #03C75A",
  borderRadius: 10, marginBottom: 16,
};

const primaryButtonStyle = {
  flex: 1, padding: 10,
  background: "#03C75A", border: "none",
  borderRadius: 6, color: "#fff",
  fontSize: 12, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryButtonStyle = {
  padding: "10px 16px", background: "transparent",
  border: "1px solid var(--border)", borderRadius: 6,
  color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
  fontFamily: "inherit",
};

const cardStyle = {
  padding: 12,
  background: "var(--usol-n-card-bg)",
  border: "1px solid var(--usol-n-border)",
  borderRadius: 10, marginBottom: 6,
  boxShadow: "var(--usol-n-shadow)",
};

const cardGroupStyle = {
  ...cardStyle,
  borderLeft: "3px solid #A855F7",
};

const statusBadgeStyle = {
  fontSize: 9, color: "var(--text-secondary)",
  background: "var(--bg-inset, var(--bg-secondary))",
  padding: "1px 5px", borderRadius: 3,
};

const groupBadgeStyle = {
  fontSize: 9, color: "#A855F7",
  background: "rgba(168,85,247,0.15)",
  padding: "1px 5px", borderRadius: 3,
};

export default UsolNOrders;
