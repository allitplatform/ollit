# -*- coding: utf-8 -*-
# 접수함 C안 (통화 데스크형) + 접수시각 + 중복번호 판별 — AdminInquiriesScreen.jsx
import io, sys

P = "/sessions/rcw-01u4et6pwfchupgdzvaelxyk/mnt/ollit/src/components/admin/AdminInquiriesScreen.jsx"
s = io.open(P, encoding="utf-8").read()
orig_len = len(s)

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        print("FAIL %s anchor count=%d" % (label, n)); sys.exit(1)
    s = s.replace(old, new)
    print("ok", label)

def slice_rep(start_marker, end_marker, new_text, label):
    global s
    if s.count(start_marker) != 1:
        print("FAIL %s start count=%d" % (label, s.count(start_marker))); sys.exit(1)
    i = s.find(start_marker)
    j = s.find(end_marker, i + len(start_marker))
    if j < 0:
        print("FAIL %s end not found" % label); sys.exit(1)
    s = s[:i] + new_text + s[j:]
    print("ok", label)


# ── [1] 공용 헬퍼 (경과·접수시각·중복번호) ─────────────────
rep(
'''function shortRegion() { return ""; }''',
'''function shortRegion() { return ""; }

// 2026-07-26 — C안 (통화 데스크형) 공용 헬퍼.
function _digits(v) { return String(v || "").replace(/\\D/g, ""); }

// 경과 배지 — 새 접수 카드와 같은 규칙 (3시간 노랑 / 24시간 빨강).
function elapsedInfo(value) {
  if (!value) return { label: "", level: "ok" };
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return { label: "", level: "ok" };
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  const level = mins >= 1440 ? "late" : mins >= 180 ? "warn" : "ok";
  let label;
  if (mins < 1) label = "방금";
  else if (mins < 60) label = mins + "분 전";
  else if (mins < 1440) label = Math.floor(mins / 60) + "시간 전";
  else label = Math.floor(mins / 1440) + "일 전";
  return { label, level };
}
const EL_STYLE = {
  ok:   { background: "#F4F6FA", color: "#93A2B4" },
  warn: { background: "#FEF3C7", color: "#B45309" },
  late: { background: "#FEE2E2", color: "#DC2626" },
};

// 접수 시각 — "오늘 09:12" / "어제 14:20" / "7/24 11:02" (사장님 spec 2026-07-26).
function receivedLabel(value) {
  if (!value) return "";
  const ymd = toKstYmd(value);
  const hm  = toKstHm(value);
  if (!ymd) return "";
  const today = toKstYmd(new Date());
  if (ymd === today) return "오늘 " + hm;
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (ymd === toKstYmd(y)) return "어제 " + hm;
  const parts = ymd.split("-");
  return Number(parts[1]) + "/" + Number(parts[2]) + " " + hm;
}

// 2026-07-26 — 중복 번호 판별 (사장님 spec: 전화로 이미 다른 운영자가 접수했을 수 있음).
//   apiTasks (취소 제외) 에서 같은 번호 (뒤 8자리 일치) 작업 최대 3건.
//   서버 조회 없음 — 이미 로드된 전체 작업 목록 대조라 즉시.
function findDupTasks(apiTasks, phone) {
  const pd = _digits(phone);
  if (pd.length < 8) return [];
  const tail = pd.slice(-8);
  const out = [];
  for (const tk of (apiTasks || [])) {
    if (!tk || tk.status === "취소") continue;
    const td = _digits(tk.phone || tk.연락처 || "");
    if (td.length >= 8 && td.slice(-8) === tail) {
      out.push(tk);
      if (out.length >= 3) break;
    }
  }
  return out;
}
function dupSummary(dups) {
  if (!dups.length) return "";
  const f = dups[0];
  const code = f.taskCode || f.task_code || "작업";
  const st   = f.status || "";
  return code + (st ? " · " + st : "") + (dups.length > 1 ? " 외 " + (dups.length - 1) + "건" : "");
}''',
"helpers")


# ── [2] convertMobile — 중복 경고 포함 confirm ─────────────
rep(
'''  // 모바일 [작업 전환] — 부모 prefill 라우팅에 위임
  function convertMobile(row) {
    if (busyId) return;
    if (!onConvertToForm) return;
    const ok = window.confirm("새 접수 폼이 열립니다.\\n기종·수량·일정·금액을 보강하여 등록해 주세요.");
    if (!ok) return;
    onConvertToForm(row);
  }''',
'''  // 모바일 [작업 전환] — 부모 prefill 라우팅에 위임.
  //   2026-07-26 — 같은 번호 작업이 이미 있으면 confirm 에 명시 (중복 접수 방지).
  function convertMobile(row) {
    if (busyId) return;
    if (!onConvertToForm) return;
    const dups = findDupTasks(apiTasks, row.phone);
    const warn = dups.length
      ? "⚠️ 같은 번호의 작업이 이미 있습니다!\\n" +
        dups.map(d => "· " + (d.taskCode || d.task_code || "작업") + " " + (d.status || "") + " " + (d.customer || "")).join("\\n") +
        "\\n다른 운영자가 전화로 먼저 접수했을 수 있습니다.\\n\\n"
      : "";
    const ok = window.confirm(warn + "새 접수 폼이 열립니다.\\n기종·수량·일정·금액을 보강하여 등록해 주세요.");
    if (!ok) return;
    onConvertToForm(row);
  }''',
"convertMobile")


# ── [3] MiniCardRow → 통화 데스크형 전면 교체 ──────────────
slice_rep(
"function MiniCardRow(",
"\\n// ===========================================================\\n// PC — 2단".replace("\\n", chr(10)),
'''function MiniCardRow({ row, busy, apiTasks = [], onCall, onSpam, onDelete, onConvert }) {
  // 2026-07-26 — C안 통화 데스크형 (사장님 확정).
  //   좌 큰 전화 버튼 (탭 = 발신만, 상태 변경 없음) / 정보 2~3행 / 하단 단계 행.
  //   단계: ① 통화함 (contacted 처리) → ② 작업 전환 → ✕ 스팸.
  //   경과 배지 + 접수 시각 + 중복 번호 경고 표시.
  const isNew       = row.status === "new";
  const isContacted = row.status === "contacted";
  const isSpam      = row.status === "spam";
  const canDelete   = isSpam && !row.task_id;
  const el   = elapsedInfo(row.created_at);
  const dups = findDupTasks(apiTasks, row.phone);

  const stepBase = {
    flex: 1, padding: "9px 0", textAlign: "center",
    background: "transparent", border: "none",
    borderRight: "1px solid #E5EAF1",
    fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <article style={{
      background: "#fff",
      borderRadius: 13,
      border: "1px solid #E5EAF1",
      borderLeft: isNew ? "3px solid #DC2626" : "1px solid #E5EAF1",
      overflow: "hidden",
      opacity: busy ? 0.55 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px" }}>
        {/* 좌 — 큰 전화 버튼 (발신 전용) */}
        <a
          href={row.phone ? `tel:${row.phone}` : undefined}
          aria-label="전화 걸기"
          style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: isContacted ? "#D1FAE5" : "#059669",
            color: isContacted ? "#059669" : "#fff",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textDecoration: "none",
            opacity: row.phone ? 1 : 0.35,
            pointerEvents: row.phone ? "auto" : "none",
          }}
        >
          <Phone size={17}/>
          <span style={{ fontSize: 8, fontWeight: 800, marginTop: 1 }}>
            {isContacted ? "재통화" : "전화"}
          </span>
        </a>

        {/* 중앙 — 정보 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 14.5, fontWeight: 800, color: "#1C2B3A",
              letterSpacing: "-0.3px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              minWidth: 0,
            }}>{row.name || "이름 미입력"}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: "#2563EB",
              background: "#EAF2FB", padding: "2px 8px", borderRadius: 999,
              whiteSpace: "nowrap", flexShrink: 0,
            }}>{serviceLabel(row.service_type)}</span>
            {el.label && (
              <span style={{
                marginLeft: "auto", flexShrink: 0,
                fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 6,
                ...EL_STYLE[el.level],
              }}>{el.label}</span>
            )}
          </div>
          <div style={{
            fontSize: 11.5, color: "#6A7D94", marginTop: 3,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {row.phone || "연락처 없음"}
            <span style={{ color: "#B7C1CE" }}> · </span>
            <span style={{ fontWeight: 700 }}>{receivedLabel(row.created_at)} 접수</span>
          </div>
          {row.address && (
            <div style={{
              fontSize: 11.5, color: "#93A2B4", marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>📍 {row.address}</div>
          )}
          {row.memo && (
            <div style={{
              fontSize: 11.5, color: "#4A5A70", marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>“{row.memo}”</div>
          )}
          {isSpam && (
            <div style={{
              marginTop: 3, fontSize: 11, color: "#93A2B4", fontWeight: 700,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              사유: <span style={{ color: row.spam_reason ? "#6B7280" : "#B7C1CE" }}>
                {row.spam_reason || "사유 없음"}</span>
            </div>
          )}
          {dups.length > 0 && !isSpam && (
            <div style={{
              marginTop: 5, padding: "5px 9px",
              background: "#FEE2E2", borderRadius: 8,
              fontSize: 10.5, fontWeight: 800, color: "#DC2626",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>⚠️ 같은 번호 작업 있음 — {dupSummary(dups)}</div>
          )}
        </div>
      </div>

      {/* 하단 — 단계 행 (스팸이면 삭제 행) */}
      {isSpam ? (
        <div style={{ display: "flex", borderTop: "1px solid #E5EAF1" }}>
          <button
            onClick={onDelete}
            disabled={busy || !canDelete}
            style={{
              ...stepBase, borderRight: "none",
              color: canDelete ? "#DC2626" : "#B7C1CE",
              cursor: canDelete ? "pointer" : "not-allowed",
            }}
          >🗑 삭제 (영구){!canDelete && row.task_id ? " — 전환된 실데이터" : ""}</button>
        </div>
      ) : (
        <div style={{ display: "flex", borderTop: "1px solid #E5EAF1" }}>
          <button
            onClick={onCall}
            disabled={busy || isContacted}
            style={{
              ...stepBase,
              color: isContacted ? "#059669" : "#2563EB",
              background: isContacted ? "#D1FAE5" : "transparent",
              cursor: isContacted ? "default" : "pointer",
            }}
          >{isContacted ? "✓ 통화함" : "① 통화함"}</button>
          <button onClick={onConvert} disabled={busy}
            style={{ ...stepBase, color: "#2563EB" }}
          >② 작업 전환</button>
          <button onClick={onSpam} disabled={busy}
            style={{ ...stepBase, borderRight: "none", color: "#93A2B4" }}
          >✕ 스팸</button>
        </div>
      )}
    </article>
  );
}
''',
"MiniCardRow→CallDesk")


# ── [4] PcListRow — 경과·접수시각·메모·중복 표시 ───────────
slice_rep(
"function PcListRow(",
"\\nfunction PcDetailPanel(".replace("\\n", chr(10)),
'''function PcListRow({ row, selected, apiTasks = [], onClick }) {
  // 2026-07-26 — C안 공통 개선: 경과 배지 + 접수 시각 + 메모 한 줄 + 중복 경고.
  const isNew  = row.status === "new";
  const isSpam = row.status === "spam";
  const el   = elapsedInfo(row.created_at);
  const dups = findDupTasks(apiTasks, row.phone);
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%",
      background: selected ? "#EAF2FB" : "#fff",
      border: selected ? "2px solid #2563EB" : "1px solid #E5EAF1",
      borderLeft: isNew && !selected ? "3px solid #DC2626" : (selected ? "2px solid #2563EB" : "1px solid #E5EAF1"),
      borderRadius: 8,
      padding: "10px 11px",
      cursor: "pointer", textAlign: "left",
      fontFamily: "inherit",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{
          fontSize: 13.5, fontWeight: 800, color: "#1C2B3A",
          letterSpacing: "-0.3px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          minWidth: 0,
        }}>{row.name || "이름 미입력"}</span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: "#2563EB",
          background: selected ? "#fff" : "#EAF2FB", padding: "1px 7px", borderRadius: 999,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>{serviceLabel(row.service_type)}</span>
        {row.status === "contacted" && (
          <span style={{
            fontSize: 9.5, fontWeight: 800, color: "#059669",
            background: "#D1FAE5", padding: "1px 6px", borderRadius: 6, flexShrink: 0,
          }}>통화함</span>
        )}
        {el.label && (
          <span style={{
            marginLeft: "auto", flexShrink: 0,
            fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 6,
            ...EL_STYLE[el.level],
          }}>{el.label}</span>
        )}
      </div>
      <div style={{
        fontSize: 11.5, color: "#6A7D94",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {row.phone || "연락처 없음"}
        <span style={{ color: "#B7C1CE" }}> · </span>
        {receivedLabel(row.created_at)}
      </div>
      {row.memo && (
        <div style={{
          marginTop: 2, fontSize: 11, color: "#4A5A70",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>“{row.memo}”</div>
      )}
      {isSpam && (
        <div style={{
          marginTop: 3, fontSize: 11, color: "#93A2B4", fontWeight: 700,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          사유: <span style={{
            color: row.spam_reason ? "#6B7280" : "#B7C1CE",
            fontWeight: row.spam_reason ? 800 : 600,
          }}>{row.spam_reason || "사유 없음"}</span>
        </div>
      )}
      {dups.length > 0 && !isSpam && (
        <div style={{
          marginTop: 4, fontSize: 10.5, fontWeight: 800, color: "#DC2626",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>⚠️ 같은 번호 작업 — {dupSummary(dups)}</div>
      )}
    </button>
  );
}

''',
"PcListRow")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("WROTE part1 (%d -> %d)" % (orig_len, len(s)))
