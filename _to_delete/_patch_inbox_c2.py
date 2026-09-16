# -*- coding: utf-8 -*-
# 접수함 C안 part2 — PcDetailPanel 교체 + callsite prop 추가
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

# ── [5] PcDetailPanel 전면 교체 (다음 function 직전까지) ────
start = "function PcDetailPanel("
if s.count(start) != 1:
    print("FAIL PcDetailPanel start count=%d" % s.count(start)); sys.exit(1)
i = s.find(start)
j = s.find("\nfunction ", i + len(start))
if j < 0:
    print("FAIL PcDetailPanel end"); sys.exit(1)

new_detail = '''function PcDetailPanel({ t, user, row, busy, apiTasks = [], onCall, onSpam, onDelete, onClose, onSubmitDone }) {
  // 2026-07-26 — C안 공통 개선: 접수시각+경과 명시 / 큰 전화 버튼 / 중복 번호 경고 박스.
  const at = toKstYmdHm(row.created_at);
  const el = elapsedInfo(row.created_at);
  const dups = findDupTasks(apiTasks, row.phone);
  const initial = {
    principal: "올데이케어",   // PRINCIPALS[0].id 정확 일치
    customer:  row.name    || "",
    phone:     row.phone   || "",
    address:   row.address || "",
    workItems: [],
    memo: `[홈페이지 접수${at ? " " + at : ""}] 희망 서비스: ${serviceLabel(row.service_type)}`,
  };
  const isNew  = row.status === "new";
  const isSpam = row.status === "spam";

  return (
    <div>
      {/* 상단 요약 */}
      <div style={{
        background: "#fff", border: "1px solid #E5EAF1",
        borderRadius: 12, padding: "16px 18px", marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <ServiceTypeIcon
            workType={SERVICE_WORKTYPE[row.service_type] || ""}
            size={18}
            showLabel={false}
          />
          <span style={{
            fontSize: 12.5, fontWeight: 800, color: "#2563EB",
            background: "#EAF2FB", padding: "3px 10px", borderRadius: 999,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{serviceLabel(row.service_type)}</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#1C2B3A", letterSpacing: "-0.5px" }}>
            {row.name || "이름 미입력"}
          </span>
          {isNew && (
            <span style={{
              background: "#DC2626", color: "#fff",
              fontSize: 11, fontWeight: 800,
              padding: "3px 9px", borderRadius: 100,
            }}>신규</span>
          )}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6A7D94", fontWeight: 700 }}>
              {receivedLabel(row.created_at)} 접수
            </span>
            {el.label && (
              <span style={{
                fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                ...EL_STYLE[el.level],
              }}>{el.label}</span>
            )}
          </span>
          <button onClick={onClose} aria-label="닫기" style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#93A2B4", padding: 2, display: "inline-flex",
          }}>
            <X size={16} />
          </button>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px",
          fontSize: 14, color: "#1C2B3A",
        }}>
          <span style={{ color: "#93A2B4", fontWeight: 600 }}>연락처</span>
          <span style={{ fontWeight: 700 }}>
            {row.phone
              ? <a href={`tel:${row.phone}`} style={{ color: "#2563EB", textDecoration: "none" }}>{row.phone}</a>
              : "-"}
          </span>
          <span style={{ color: "#93A2B4", fontWeight: 600 }}>주소</span>
          <span>{row.address || "-"}</span>
          {row.memo && (<>
            <span style={{ color: "#93A2B4", fontWeight: 600 }}>메모</span>
            <span style={{ color: "#4A5A70", whiteSpace: "pre-line" }}>{row.memo}</span>
          </>)}
        </div>

        {/* 2026-07-26 — 중복 번호 경고 (작업 전환 전 반드시 보이도록 요약 카드 안). */}
        {dups.length > 0 && !isSpam && (
          <div style={{
            marginTop: 12, padding: "10px 13px",
            background: "#FEE2E2", border: "1px solid #FECACA",
            borderRadius: 9, fontSize: 13, color: "#B91C1C", fontWeight: 700,
            lineHeight: 1.7,
          }}>
            ⚠️ 같은 번호의 작업이 이미 있습니다 — 다른 운영자가 전화로 먼저 접수했을 수 있습니다.
            {dups.map(d => (
              <div key={d.id || d.taskCode} style={{ fontSize: 12.5, fontWeight: 800 }}>
                · {(d.taskCode || d.task_code || "작업")} {(d.status || "")} {(d.customer || "")}
                {d.assignedEngineer ? ` — ${d.assignedEngineer}` : ""}
              </div>
            ))}
          </div>
        )}

        {/* 2026-07-11 — 스팸 사유 표시 (Mig 170). */}
        {isSpam && (
          <div style={{
            marginTop: 12, padding: "9px 12px",
            background: "#F4F6FA", border: "1px solid #E5EAF1",
            borderRadius: 8, fontSize: 13, color: "#4A5A70",
          }}>
            <span style={{ color: "#93A2B4", fontWeight: 700, marginRight: 6 }}>사유</span>
            <span style={{
              fontWeight: row.spam_reason ? 800 : 600,
              color: row.spam_reason ? "#1C2B3A" : "#B7C1CE",
            }}>{row.spam_reason || "사유 없음"}</span>
          </div>
        )}

        {/* 액션 — 2026-07-26 C안: 큰 전화 버튼 신설 (기존엔 tel 텍스트 링크뿐). */}
        {isSpam ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <SmallBtn
              label="삭제 (영구)"
              color="#DC2626"
              disabled={busy || !!row.task_id}
              onClick={onDelete}
            />
            {row.task_id && (
              <span style={{ fontSize: 11, color: "#93A2B4", fontWeight: 600 }}>
                전환된 실데이터는 삭제 불가
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            {row.phone && (
              <a href={`tel:${row.phone}`} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#059669", color: "#fff",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 800, textDecoration: "none",
              }}>
                <Phone size={14}/> 전화
              </a>
            )}
            <SmallBtn label="✓ 통화함 처리" color="#2563EB"
              disabled={busy || row.status === "contacted"} onClick={onCall}/>
            <SmallBtn label="스팸 처리" color="#6B7280" disabled={busy} onClick={onSpam}/>
          </div>
        )}
      </div>

      {/* 하단 — 새 접수 폼 임베드 (prefill) */}
      <div style={{
        background: "#fff", border: "1px solid #E5EAF1", borderRadius: 12,
        padding: 0, overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 18px", borderBottom: "1px solid #E5EAF1",
          fontSize: 13, fontWeight: 800, color: "#1C2B3A", letterSpacing: "-0.2px",
          background: "#F8FBFF",
        }}>
          작업 전환 — 기종·수량·일정·금액 보강 후 등록
        </div>
        <div>
          <NewReceptionPcForm
            t={t}
            user={user}
            initial={initial}
            onBack={onClose}
            onSubmit={onSubmitDone}
          />
        </div>
      </div>
    </div>
  );
}

'''
s = s[:i] + new_detail + s[j + 1:]
print("ok PcDetailPanel")

# ── [6] callsite prop 추가 ─────────────────────────────────
rep(
"""            <MiniCardRow
              key={row.id}
              row={row}""",
"""            <MiniCardRow
              key={row.id}
              row={row}
              apiTasks={apiTasks}""",
"MiniCardRow callsite")

rep(
"""              <PcListRow
                key={row.id}
                row={row}
                selected={selectedRow?.id === row.id}""",
"""              <PcListRow
                key={row.id}
                row={row}
                apiTasks={apiTasks}
                selected={selectedRow?.id === row.id}""",
"PcListRow callsite")

rep(
"""          <PcDetailPanel
            t={t}
            user={user}
            row={selectedRow}""",
"""          <PcDetailPanel
            t={t}
            user={user}
            apiTasks={apiTasks}
            row={selectedRow}""",
"PcDetailPanel callsite")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("WROTE part2 (%d -> %d)" % (orig_len, len(s)))
