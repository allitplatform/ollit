// V11-5 — 작업 완료 화면 (단순화 버전)
// 사장님 의도: 사진 = 인증용 / 분류 X / 1-3장 / 빠르게
// 기존 EngineerApp의 CompletionReportScreen은 그대로 보존. 이 컴포넌트는 별도.
// 통합 시점: 사장님 사진 검증 후 EngineerApp 라우트 alias 교체.
import { useState, useRef } from "react";
import { updateTask } from "../data/tasks.js";

export function TaskCompleteScreen({ task, onComplete, onCancel }) {
  const [photos, setPhotos] = useState([]);
  const [memo, setMemo]     = useState("");
  const fileInputRef = useRef(null);

  const PHOTO_MIN = 1;
  const PHOTO_MAX = 3;

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > PHOTO_MAX) {
      window.alert(`사진은 최대 ${PHOTO_MAX}장까지 가능합니다.`);
      return;
    }
    const next = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    }));
    setPhotos(prev => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemovePhoto(idx) {
    setPhotos(prev => {
      const next = [...prev];
      try { URL.revokeObjectURL(next[idx].url); } catch {}
      next.splice(idx, 1);
      return next;
    });
  }

  function handleComplete() {
    if (photos.length < PHOTO_MIN) {
      const ok = window.confirm("사진 없이 완료할까요?");
      if (!ok) return;
    }
    if (task?.id) {
      updateTask(task.id, {
        status:      "completed",
        state:       "done",
        completedAt: new Date().toISOString(),
        // 실제 업로드는 V12에서 — 지금은 메타데이터(uploadedAt)만 저장
        photos:      photos.map(p => ({ uploadedAt: p.uploadedAt })),
        memo,
      });
    }
    onComplete?.({
      photos: photos.map(p => ({ uploadedAt: p.uploadedAt })),
      memo,
    });
  }

  return (
    <div style={containerStyle}>
      {/* 헤더 */}
      <div style={headerStyle}>
        {onCancel && (
          <button onClick={onCancel} style={backBtnStyle}>←</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>✓ 작업 완료</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
            {task?.customer || "—"}{task?.address ? ` · ${String(task.address).split("(")[0].trim()}` : ""}
          </div>
        </div>
      </div>

      {/* 사진 인증 박스 */}
      <div style={cardStyle}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>📷 인증 사진</div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 2 }}>
              완료 증명용 ({PHOTO_MIN}–{PHOTO_MAX}장 / 권장 1장)
            </div>
          </div>
          <span style={{
            fontSize: 11,
            color: photos.length >= PHOTO_MIN ? "#00875A" : "#888780",
          }}>
            {photos.length}/{PHOTO_MAX}
          </span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6, marginBottom: 10,
        }}>
          {photos.map((photo, idx) => (
            <div
              key={idx}
              style={{
                position: "relative",
                aspectRatio: "1",
                background: `url(${photo.url}) center/cover`,
                borderRadius: 6,
              }}
            >
              <button
                onClick={() => handleRemovePhoto(idx)}
                style={{
                  position: "absolute", top: 4, right: 4,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)", border: "none",
                  color: "#fff", fontSize: 10,
                  cursor: "pointer", fontFamily: "inherit",
                }}
                aria-label="사진 삭제"
              >✕</button>
            </div>
          ))}

          {photos.length < PHOTO_MAX && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                aspectRatio: "1",
                background: "var(--bg-secondary)",
                border: "2px dashed #FF1B8D",
                borderRadius: 6,
                color: "#FF1B8D",
                fontSize: 24, cursor: "pointer", fontFamily: "inherit",
              }}
              aria-label="사진 추가"
            >📷</button>
          )}
        </div>

        {photos.length === 0 && (
          <div style={{
            fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))",
            textAlign: "center", padding: 6,
          }}>
            완료된 모습 한 장이면 충분합니다
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          multiple
          onChange={handlePhotoSelect}
          style={{ display: "none" }}
        />
      </div>

      {/* 메모 (선택) */}
      <div style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          📝 메모 (선택)
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="특이사항 있으면 짧게 (선택)"
          style={{
            width: "100%", minHeight: 60,
            padding: 8,
            background: "var(--bg-inset, var(--bg-secondary))",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 11, fontFamily: "inherit",
            resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* 완료 버튼 */}
      <button
        onClick={handleComplete}
        style={{
          width: "100%", padding: 16,
          background: "#00875A", border: "none",
          borderRadius: 12, color: "#fff",
          fontSize: 14, fontWeight: 700,
          cursor: "pointer", marginBottom: 8, fontFamily: "inherit",
        }}
      >
        ✓ 작업 완료
      </button>
    </div>
  );
}

const containerStyle = {
  padding: 16, minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  overflowY: "auto",
};

const headerStyle = {
  display: "flex", alignItems: "center", gap: 10,
  marginBottom: 14, paddingBottom: 14,
  borderBottom: "1px solid var(--border)",
};

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 20,
  cursor: "pointer", padding: 4, fontFamily: "inherit",
};

const cardStyle = {
  padding: 14,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 12, marginBottom: 14,
};

export default TaskCompleteScreen;
