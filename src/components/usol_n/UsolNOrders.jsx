// Phase 5 Step 0.B — 유솔N · 접수 탭 (DB 전환)
// 2026-05-19
// 변경:
//   - loadTasks() (localStorage) → fetchUsolNTasks() (Supabase)
//   - 1 task = 1 줄 + task_items 측 작업 종류 칩 + 정산 사이클 색상 상태
//   - 페이지네이션 50건/page
//   - 기존 CSV 업로드 영역은 일단 유지 (UI 그대로 / DB INSERT 흐름은 Stage 0.C/0.D 측 정정 spec)
import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  csvOrderRowToTask,
} from "../../data/usolNOrderCsv.js";
import {
  loadTasks, saveTasks, findTaskByProductOrderId,
} from "../../data/tasks.js";
import { fetchUsolNTasks, getTaskSettlementColor, getItemSettlementColor, getItemChipLabel } from "../../lib/usolNTasksDb.js";

const PAGE_SIZE = 50;

export function UsolNOrders() {
  const [pendingRows, setPendingRows] = useState([]);
  const fileInputRef = useRef(null);

  // DB fetch state (Phase 5 Step 0.B)
  const [tasks, setTasks]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0); // 0-indexed
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // status = '미배정' (옛 'received' 매핑) — 접수 탭 = 미배정만
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchError("");
    fetchUsolNTasks({ statusIn: ["미배정"], limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setFetchError(res.error || "불러오기 실패");
          setTasks([]);
          setTotal(0);
        } else {
          setTasks(res.tasks);
          setTotal(res.total);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, reloadTick]);

  function refresh() { setReloadTick(v => v + 1); }

  // CSV 업로드 → 파싱 → 중복 제거 → 미리보기 (Stage 0.B는 기존 흐름 유지 / DB INSERT는 0.C 정정)
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
    // Stage 0.B — 기존 localStorage 측 일단 유지 (0.C 정정 spec / DB INSERT 흐름)
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        접수 대기{" "}
        <span style={{ color: "#03C75A", fontWeight: 700 }}>{total.toLocaleString()}</span>건
        {totalPages > 1 && (
          <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 6 }}>
            · {page + 1} / {totalPages}p
          </span>
        )}
      </div>

      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : fetchError ? (
        <Empty>⚠️ {fetchError}</Empty>
      ) : tasks.length === 0 ? (
        <Empty>대기 중인 새 접수가 없습니다</Empty>
      ) : (
        tasks.map(task => <TaskRow key={task.id} task={task}/>)
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage}/>
      )}
    </div>
  );
}

// 1 task = 1 줄 (사장님 spec)
// 좌: 색상 dot + 고객명 + task_no + 작업 종류 칩 (task_items별)
// 우: total_amount
function TaskRow({ task }) {
  const taskColor = getTaskSettlementColor(task);
  const items     = task.task_items || [];

  return (
    <div style={{
      padding: 12,
      background: "var(--usol-n-card-bg)",
      border: "1px solid var(--usol-n-border)",
      borderLeft: `3px solid ${taskColor.color === "#1D9E75" ? "#1D9E75" :
                                taskColor.color === "#F59E0B" ? "#F59E0B" :
                                taskColor.color === "#FACC15" ? "#FACC15" : "var(--usol-n-border)"}`,
      borderRadius: 10, marginBottom: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12 }}>{taskColor.dot}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {task.customer_name || "—"}
          </span>
          <span style={taskNoStyle}>{task.task_no || ""}</span>
        </div>
        <span style={{ fontSize: 13, color: "#03C75A", fontWeight: 700, fontFamily: "inherit" }}>
          ₩{(task.total_amount || 0).toLocaleString()}
        </span>
      </div>

      {task.address && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>
          {String(task.address).split("(")[0].trim()}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {items.map(item => {
            const c = getItemSettlementColor(item);
            return (
              <span key={item.id} style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 9,
                color: "var(--text-primary)",
                background: "var(--bg-secondary)",
                border: `1px solid ${c.color}`,
                padding: "2px 6px", borderRadius: 4, fontWeight: 600,
              }}>
                <span style={{ fontSize: 9 }}>{c.dot}</span>
                <span>{getItemChipLabel(item)} ×{item.qty || 1}</span>
              </span>
            );
          })}
        </div>
      )}

      {task.received_at && (
        <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 6 }}>
          {new Date(task.received_at).toLocaleDateString("ko-KR")} 접수 · {task.phone || "—"}
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={pageBtnStyle(page === 0)}
      >← 이전</button>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        style={pageBtnStyle(page >= totalPages - 1)}
      >다음 →</button>
    </div>
  );
}

function pageBtnStyle(disabled) {
  return {
    padding: "6px 12px",
    background: disabled ? "transparent" : "var(--bg-secondary)",
    border: "1px solid var(--border)", borderRadius: 6,
    color: disabled ? "var(--text-tertiary, var(--text-secondary))" : "var(--text-primary)",
    fontSize: 11, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", opacity: disabled ? 0.5 : 1,
  };
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

const taskNoStyle = {
  fontSize: 9, color: "var(--text-secondary)",
  background: "var(--bg-inset, var(--bg-secondary))",
  padding: "1px 5px", borderRadius: 3,
  fontFamily: "inherit",
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

export default UsolNOrders;
