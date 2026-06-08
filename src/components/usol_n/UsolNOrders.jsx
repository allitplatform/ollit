// Phase 5 Step 0.B — 유솔N · 접수 탭 (DB 전환)
// 2026-05-19 — 목록 측 Supabase 측 측 (fetchUsolNTasks)
// 2026-05-23 — CSV 업로드 측 측 localStorage → Supabase DB INSERT 측 전환
//   · parseNaverOrders (src/lib/naverOrderParser.js) 측 측 측 — NaverUploadScreen 측 측 측
//   · bulkInsertUsolNOrders (src/lib/usolNTasksDb.js) 측 일괄 INSERT
//   · 중복 체크 측 DB level (external_order_no) 측 위임 — 미리보기 측 측 전체 주문 수 표시
//   · 결과 banner 측 inserted / skipped / warnings / errors 측 표시 (첫 에러 메시지 포함)
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { parseNaverOrders } from "../../lib/naverOrderParser.js";
import { fetchUsolNTasks, getTaskSettlementColor, getItemSettlementColor, getItemChipLabel, bulkInsertUsolNOrders } from "../../lib/usolNTasksDb.js";
import { formatYmdHm } from "../../utils/dateLabel.js";
// Phase 5 Step 0.C-9 — realtime subscription (tasks + task_items 변경 시 자동 refetch)
import { useRealtimeTasks, useRealtimeTable } from "../../hooks/useRealtimeSubscription.js";

const PAGE_SIZE = 50;

// hideList=true → 업로드 영역만 (PrincipalApp 측 catch 측 catch 측 측 X 측 X 측 X)
export function UsolNOrders({ onTaskClick, hideList = false }) {
  // 2026-05-23 — pendingRows → pendingOrders (parseNaverOrders 측 결과 측 측)
  //   importing / importResult 측 — DB INSERT 진행 측 + 결과 표시 측
  const [pendingOrders, setPendingOrders] = useState([]);
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);
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

  // Phase 5 Step 0.C-9 — realtime subscription
  useRealtimeTasks(() => refresh());
  useRealtimeTable("task_items", () => refresh());

  // 2026-05-23 — CSV 업로드 → parseNaverOrders → 미리보기 → DB INSERT
  //   중복 체크 측 DB level (external_order_no) 측 위임 — 미리보기 측 측 전체 주문 수 표시
  // 2026-05-26 — 드래그 앤 드롭 측 catch handleFile(file) 측 catch 분리. handleFileSelect 측 catch <input onChange> 측 catch 측 catch.
  function handleFile(file) {
    if (!file) return;
    // 확장자 검증 — .xlsx / .xls / .csv 측 catch 측 catch 측 measurement (alert 측 catch)
    const ext = String(file.name || "").toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      alert(`엑셀/CSV 파일만 가능합니다 (.xlsx, .xls, .csv). 확장자: .${ext}`);
      return;
    }
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        // 2026-05-23 — cellDates:true 측 — 날짜 셀 측 Date 객체 측 (Excel serial 숫자 X)
        //   timestamptz 측 INSERT 측 측 측 (Migration 002a external_received_at)
        const wb   = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const { orders } = parseNaverOrders(rows);
        setPendingOrders(orders);
      } catch (err) {
        console.error("[UsolNOrders.parse]", err);
        alert("CSV 파싱 실패: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileSelect(e) {
    handleFile(e.target.files?.[0]);
  }

  async function handleConfirmImport() {
    if (pendingOrders.length === 0 || importing) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await bulkInsertUsolNOrders(pendingOrders);
      setImportResult(res);
      if (res?.ok !== false) {
        setPendingOrders([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        refresh();
      }
    } catch (err) {
      console.error("[UsolNOrders.import]", err);
      setImportResult({ ok: false, error: err.message || "일괄 등록 실패" });
    } finally {
      setImporting(false);
    }
  }

  function handleCancel() {
    setPendingOrders([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <UploadBox
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        onFile={handleFile}
        pendingCount={pendingOrders.length}
        importing={importing}
        onConfirm={handleConfirmImport}
        onCancel={handleCancel}
      />
      {importResult && <ImportResultBanner result={importResult} onDismiss={() => setImportResult(null)} />}

      {!hideList && (
        <>
          <div style={sectionTitleStyle}>
            접수 대기{" "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{total.toLocaleString()}</span>건
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
            tasks.map(task => <TaskRow key={task.id} task={task} onClick={onTaskClick}/>)
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage}/>
          )}
        </>
      )}
    </div>
  );
}

// 1 task = 1 줄 (사장님 spec)
// 좌: 색상 dot + 고객명 + task_no + 작업 종류 칩 (task_items별)
// 우: total_amount
// 클릭 → onClick(task) → AdminTaskDetailScreen 진입 (AdminApp 측 v14 정규화 후 navigate)
function TaskRow({ task, onClick }) {
  const taskColor = getTaskSettlementColor(task);
  const items     = task.task_items || [];
  const clickable = typeof onClick === "function";

  // 정산 사이클 색상 = 박스 왼쪽 강조선만 (사장님 spec — 고객명 앞 dot 제거)
  const leftBorderColor =
    taskColor.color === "#1D9E75" ? "#1D9E75" :
    taskColor.color === "#F59E0B" ? "#F59E0B" :
    taskColor.color === "#FACC15" ? "#FACC15" : "var(--usol-n-border)";

  return (
    <div
      onClick={clickable ? () => onClick(task) : undefined}
      style={{
        padding: 10,
        background: "var(--usol-n-card-bg)",
        border: "1px solid var(--usol-n-border)",
        borderLeft: `3px solid ${leftBorderColor}`,
        borderRadius: 10, marginBottom: 4,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {task.customer_name || "—"}
          </span>
          <span style={taskNoStyle}>{task.task_no || ""}</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, fontFamily: "inherit" }}>
          ₩{(task.total_amount || 0).toLocaleString()}
        </span>
      </div>

      {task.address && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
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
                padding: "2px 5px", borderRadius: 4, fontWeight: 600,
              }}>
                <span style={{ fontSize: 9 }}>{c.dot}</span>
                <span>{getItemChipLabel(item)} ×{item.qty || 1}</span>
              </span>
            );
          })}
        </div>
      )}

      {task.received_at && (
        <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 4 }}>
          {formatYmdHm(task.received_at)} 접수 · {task.phone || "—"}
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

function UploadBox({ fileInputRef, onFileSelect, onFile, pendingCount, importing, onConfirm, onCancel }) {
  // 2026-05-26 — 드래그 앤 드롭 상태 (시각 피드백)
  const [isDragging, setIsDragging] = useState(false);

  if (pendingCount > 0) {
    return (
      <div style={uploadConfirmStyle}>
        <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}>
          📥 주문 {pendingCount}건 — 일괄 등록
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>
          중복 주문 측 DB 측 자동 제외됩니다 (결과 측 측 표시)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onConfirm} disabled={importing} style={{ ...primaryButtonStyle, opacity: importing ? 0.6 : 1, cursor: importing ? "wait" : "pointer" }}>
            {importing ? "등록 중..." : `${pendingCount}건 일괄 등록`}
          </button>
          <button onClick={onCancel} disabled={importing} style={secondaryButtonStyle}>취소</button>
        </div>
      </div>
    );
  }

  // 드래그 핸들러 — onDragOver preventDefault 필수 (안 하면 drop 측 catch X)
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && typeof onFile === "function") onFile(file);
  }

  // 드래그 중 강조 스타일 — 초록 점선 굵게 + 배경 진하게
  const activeStyle = isDragging
    ? {
        background: "var(--accent-bg)",
        border: "2px dashed var(--accent)",
        transform: "scale(1.01)",
      }
    : {};

  return (
    <div
      style={{
        ...uploadDropStyle,
        ...activeStyle,
        transition: "background 0.12s, border 0.12s, transform 0.12s",
      }}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{isDragging ? "📂" : "📤"}</div>
      <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
        {isDragging ? "여기에 놓으세요 — 접수 CSV" : "접수 CSV 업로드"}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4 }}>
        네이버 발주 엑셀 파일을 선택하거나 끌어다 놓으세요
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

function ImportResultBanner({ result, onDismiss }) {
  if (!result) return null;
  const hasError = result.ok === false || (result.errors?.length || 0) > 0;
  const inserted = result.inserted || 0;
  const skipped  = result.skipped || 0;
  const warningCount = result.warnings?.length || 0;
  const errorCount   = result.errors?.length || 0;
  const firstError   = result.errors?.[0];
  const topLevelError = result.ok === false ? result.error : null;

  const lineColor = hasError ? "#EF4444" : "var(--accent)";
  const bg = hasError ? "rgba(239,68,68,0.10)" : "var(--accent-bg)";

  return (
    <div style={{
      padding: 12,
      background: bg,
      border: `1px solid ${lineColor}`,
      borderRadius: 10, marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: lineColor }}>
          {hasError ? "⚠️ 일괄 등록 — 일부 실패" : "✅ 일괄 등록 완료"}
        </div>
        <button onClick={onDismiss} style={{
          background: "transparent", border: "none", color: "var(--text-secondary)",
          fontSize: 11, cursor: "pointer", fontFamily: "inherit",
        }}>닫기 ✕</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6 }}>
        {topLevelError && <div style={{ color: "#EF4444", marginBottom: 4 }}>오류: {topLevelError}</div>}
        <div>· 등록: <b>{inserted}</b>건</div>
        <div>· 중복 제외: <b>{skipped}</b>건</div>
        {warningCount > 0 && <div style={{ color: "#F59E0B" }}>· 경고: <b>{warningCount}</b>건 (서비스종류 이상값 — 운영자 확인 필요)</div>}
        {errorCount > 0 && (
          <div style={{ color: "#EF4444", marginTop: 4 }}>
            · 실패: <b>{errorCount}</b>건
            {firstError && (
              <div style={{ fontSize: 11, marginTop: 2, paddingLeft: 8, color: "var(--text-secondary)" }}>
                첫 에러: {firstError.error || "알 수 없음"}
                {firstError.code ? ` (${firstError.code})` : ""}
                {firstError.details ? ` — ${firstError.details}` : ""}
              </div>
            )}
          </div>
        )}
      </div>
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
  background: "var(--accent-bg)",
  border: "1px dashed var(--accent)",
  borderRadius: 10, textAlign: "center", cursor: "pointer",
  marginBottom: 16,
};

const uploadConfirmStyle = {
  padding: 14,
  background: "var(--accent-bg)",
  border: "1px solid var(--accent)",
  borderRadius: 10, marginBottom: 16,
};

const primaryButtonStyle = {
  flex: 1, padding: 10,
  background: "var(--accent)", border: "none",
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
