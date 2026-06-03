// 2026-06-03 — 기사별 달력 화면 (운영자 PWA, Phase A).
//   사장님 시안 1번 — 월 격자 + 일정 점 (세척 파랑 / 냉매 주황).
//   상단: 기사 측측 측측 (검색 측측) — 측측 측측 측측.
//   날짜 측측: KST (toKstYmd).
//   날짜 탭 → 그날 측측 측측 (시간·고객명·지역·종류).
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X, User } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import {
  bucketTasksByDate,
  classifyByService,
  getTaskService,
  getMonthGrid,
  findEngineerForTask,
} from "../../utils/engineerCalendarStats.js";

const MAX_SEARCH_RESULTS = 20;
const DEBOUNCE_MS = 200;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const COLOR_CLEANING    = "#3B82F6"; // 측측 측측
const COLOR_REFRIGERANT = "#FFB800"; // 측측 측측
const COLOR_OTHER       = "#9CA3AF"; // 측측 회색

export function EngineerCalendarScreen({
  t, apiTasks = [], apiEngineers = [], onBack, onTaskClick,
  // 2026-06-03 — 상태 lift (AdminApp 측측 측측 → 측측 측측 → 측측 측측 측측 같은 측측 측측).
  //   값이 null 측측 = 측측 측측 (= 측측 측측 측측 측측 → 측측 + 측측 측측 측측측).
  engineerId, setEngineerId,
  year, setYear,
  month, setMonth,
  selectedYmd, setSelectedYmd,
}) {
  // 측측 측측 측측 측측 default.
  const todayKst = todayYmd();
  const [y0, m0] = todayKst.split("-").map(Number);

  // 2026-06-03 — 측측 측측 측측측 (= AdminApp 측측 측측 null 측측 첫 진입 측측).
  //   measure 기사 / 측측 측측 측측측 → 측측 측측 측측 측측.
  //   apiEngineers 측측 측측 측측 (fetch 측측) → useEffect 측측 측측.
  useEffect(() => {
    if (engineerId == null && apiEngineers.length > 0) {
      setEngineerId(apiEngineers[0].id);
    }
    if (year == null)        setYear(y0);
    if (month == null)       setMonth(m0);
    if (selectedYmd == null) setSelectedYmd(todayKst);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEngineers, engineerId, year, month, selectedYmd]);

  // 검색 (기사).
  const [engQuery, setEngQuery] = useState("");
  const [engPickerOpen, setEngPickerOpen] = useState(false);

  // 측측 측측 → 기사 측측 = 측측 측측측 (= 사장님 측측: "기사 측측 시 측측 측측").
  function pickEngineer(newId) {
    setEngineerId(newId);
    setYear(y0);
    setMonth(m0);
    setSelectedYmd(todayKst);
    setEngPickerOpen(false);
    setEngQuery("");
  }

  // 2026-06-03 Phase B — 측측측 검색 (전체 측측, 측측 측측).
  const [custQuery, setCustQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(custQuery.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [custQuery]);

  // useEffect 측측 측측 측측 측측 측측 측측 측측 (= 첫 render 측측 측측 측측 X).
  const safeYear        = year        ?? y0;
  const safeMonth       = month       ?? m0;
  const safeSelectedYmd = selectedYmd ?? todayKst;

  const engineer = useMemo(
    () => apiEngineers.find(e => e.id === engineerId) || null,
    [apiEngineers, engineerId]
  );

  const filteredEngineers = useMemo(() => {
    const q = engQuery.trim().toLowerCase();
    if (!q) return apiEngineers;
    return apiEngineers.filter(e => (e.name || "").toLowerCase().includes(q));
  }, [apiEngineers, engQuery]);

  const monthGrid = useMemo(() => getMonthGrid(safeYear, safeMonth), [safeYear, safeMonth]);

  // 측측: 측측 측측 측측 dict (YMD → task[]).
  const tasksByDate = useMemo(
    () => bucketTasksByDate(apiTasks, engineer, safeYear, safeMonth),
    [apiTasks, engineer, safeYear, safeMonth]
  );

  // 측측 measure 측측.
  const monthTotal = useMemo(() => {
    let cnt = 0;
    let cleaning = 0, refrigerant = 0;
    for (const ymd of Object.keys(tasksByDate)) {
      const arr = tasksByDate[ymd];
      cnt += arr.length;
      const c = classifyByService(arr);
      cleaning    += c.cleaning;
      refrigerant += c.refrigerant;
    }
    return { cnt, cleaning, refrigerant };
  }, [tasksByDate]);

  // 측측 측측 task[] (시간 정렬).
  const dayTasks = useMemo(() => {
    const arr = (tasksByDate[safeSelectedYmd] || []).slice();
    arr.sort((a, b) => {
      const sa = a.scheduledAt || a.scheduled_at || "";
      const sb = b.scheduledAt || b.scheduled_at || "";
      return sa.localeCompare(sb);
    });
    return arr;
  }, [tasksByDate, safeSelectedYmd]);

  // 2026-06-03 Phase B — 측측측 검색 측측 (전체 apiTasks, 클라 측측).
  //   취소 측측, 측측측 측측측 측측 (= 측측측 측측 측측 측측 측측 측측 측측 측측 X).
  //   날짜 측측 (= 측측 측측 측측측 측측 측측 측측 측측 측측 측측).
  const searchResults = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (q.length === 0) return [];
    const out = [];
    for (const task of (apiTasks || [])) {
      if (task.status === "취소") continue;
      const name = String(task.customer || "").toLowerCase();
      if (!name.includes(q)) continue;
      out.push(task);
      if (out.length >= MAX_SEARCH_RESULTS * 4) break; // sort 측측 측측 측측 측측 측측.
    }
    // 측측 측측 (= scheduledAt 측측 측측 측측 측측 측측).
    out.sort((a, b) => {
      const sa = a.scheduledAt || a.scheduled_at || "";
      const sb = b.scheduledAt || b.scheduled_at || "";
      return sb.localeCompare(sa);
    });
    return out.slice(0, MAX_SEARCH_RESULTS);
  }, [apiTasks, debouncedQuery]);

  // 측측 측측 → (1) 측측 측측 측측 측측 (2) 그 달 측측 측측 (3) 측측 측측.
  function jumpToTask(task) {
    const eng = findEngineerForTask(task, apiEngineers);
    if (eng && eng.id) setEngineerId(eng.id);
    const sched = task.scheduledAt || task.scheduled_at;
    if (sched) {
      const ymd = toKstYmd(sched);
      if (ymd) {
        const [yy, mm] = ymd.split("-").map(Number);
        setYear(yy); setMonth(mm); setSelectedYmd(ymd);
      }
    }
    // 검색 측측 측측측 (= 측측 측측 측측 측측 측측 측측 측측 측측).
    setCustQuery("");
    setDebouncedQuery("");
  }

  function prevMonth() {
    if (safeMonth === 1) { setYear(safeYear - 1); setMonth(12); }
    else                 { setMonth(safeMonth - 1); }
  }
  function nextMonth() {
    if (safeMonth === 12) { setYear(safeYear + 1); setMonth(1); }
    else                  { setMonth(safeMonth + 1); }
  }
  function goToday() {
    const [yy, mm] = todayKst.split("-").map(Number);
    setYear(yy); setMonth(mm); setSelectedYmd(todayKst);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          📅 기사별 달력
        </div>
        <button onClick={goToday} style={{
          background: "transparent",
          border: `1px solid ${t.border}`,
          borderRadius: 6,
          padding: "4px 10px",
          color: t.textSecondary,
          fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>오늘</button>
      </div>

      {/* 2026-06-03 Phase B — 측측측 검색 (전체 측측, 측측 측측, 측측 측측 측측). */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px",
          background: t.bgElevated,
          border: `1px solid ${debouncedQuery ? t.accent : t.border}`,
          borderRadius: 10,
        }}>
          <Search size={15} color={debouncedQuery ? t.accent : t.textMuted}/>
          <input
            type="text"
            value={custQuery}
            onChange={e => setCustQuery(e.target.value)}
            placeholder="고객명으로 찾기 (전체 기사 대상)"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: t.text, fontSize: 13, fontFamily: "inherit",
            }}
          />
          {custQuery && (
            <button onClick={() => { setCustQuery(""); setDebouncedQuery(""); }} style={{
              background: "transparent", border: "none", padding: 0,
              cursor: "pointer", color: t.textMuted,
              display: "flex", alignItems: "center",
            }} aria-label="검색 측측측"><X size={15}/></button>
          )}
        </div>

        {debouncedQuery && (
          <div style={{
            marginTop: 8,
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${t.border}`,
              background: t.bgInset || "rgba(255,255,255,0.03)",
              fontSize: 10, fontWeight: 700, color: t.textMuted,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>"{debouncedQuery}" — {searchResults.length}건{searchResults.length === MAX_SEARCH_RESULTS ? " (최대)" : ""}</span>
              <span style={{ color: t.textDim || t.textMuted }}>측측 측측 → 측측 / 측측 측측</span>
            </div>
            {searchResults.length === 0 ? (
              <div style={{
                padding: "18px 14px", textAlign: "center",
                color: t.textMuted, fontSize: 12,
              }}>검색 결과 없음</div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {searchResults.map((task, idx) => {
                  const svc = getTaskService(task);
                  const svcColor = svc === "cleaning" ? COLOR_CLEANING
                                 : svc === "refrigerant" ? COLOR_REFRIGERANT
                                 : COLOR_OTHER;
                  const svcLabel = svc === "cleaning" ? "세척"
                                 : svc === "refrigerant" ? "냉매"
                                 : "기타";
                  const sched = task.scheduledAt || task.scheduled_at;
                  const ymd = sched ? toKstYmd(sched) : "";
                  const engName = task.assignedEngineer || task.engineer || "미배정";
                  return (
                    <button
                      key={task.id || idx}
                      onClick={() => jumpToTask(task)}
                      style={{
                        width: "100%",
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px",
                        borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer", fontFamily: "inherit",
                        textAlign: "left",
                      }}
                    >
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: svcColor, flexShrink: 0,
                      }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          <HighlightText text={task.customer || "(고객명 없음)"} query={debouncedQuery} t={t}/>
                        </div>
                        <div style={{
                          fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 2,
                          display: "flex", alignItems: "center", gap: 6,
                          overflow: "hidden", whiteSpace: "nowrap",
                        }}>
                          <span className="mono">{fmtYmdShort(ymd) || "—"}</span>
                          <span style={{ color: t.border }}>·</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <User size={10}/>{engName}
                          </span>
                          {shortRegion(task) && (
                            <>
                              <span style={{ color: t.border }}>·</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{shortRegion(task)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: svcColor,
                        padding: "2px 7px",
                        background: svcColor + "1A",
                        borderRadius: 999,
                        flexShrink: 0,
                      }}>{svcLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 기사 측측측 */}
      <div style={{ padding: "12px 16px 0" }}>
        <button
          type="button"
          onClick={() => { setEngPickerOpen(v => !v); setEngQuery(""); }}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px",
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            color: t.text,
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span>
            <span style={{ color: t.textMuted, marginRight: 6, fontWeight: 600 }}>기사</span>
            {engineer?.name || "측측 측측"}
          </span>
          <span style={{ color: t.textMuted, fontSize: 11 }}>
            {engPickerOpen ? "닫기" : "변경 ▾"}
          </span>
        </button>

        {engPickerOpen && (
          <div style={{
            marginTop: 8,
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: 10,
          }}>
            {/* 검색 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              background: t.bgInset || "rgba(255,255,255,0.03)",
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              marginBottom: 8,
            }}>
              <Search size={14} color={t.textMuted}/>
              <input
                type="text"
                value={engQuery}
                onChange={e => setEngQuery(e.target.value)}
                placeholder="기사 이름 검색"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: t.text, fontSize: 13, fontFamily: "inherit",
                }}
              />
              {engQuery && (
                <button onClick={() => setEngQuery("")} style={{
                  background: "transparent", border: "none", padding: 0,
                  cursor: "pointer", color: t.textMuted,
                  display: "flex", alignItems: "center",
                }}><X size={14}/></button>
              )}
            </div>
            {/* 목록 */}
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {filteredEngineers.length === 0 ? (
                <div style={{ padding: "10px 4px", color: t.textMuted, fontSize: 12, textAlign: "center" }}>
                  검색 결과 없음
                </div>
              ) : filteredEngineers.map(e => (
                <button
                  key={e.id}
                  onClick={() => pickEngineer(e.id)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px",
                    background: e.id === engineerId ? (t.bgInset || "rgba(255,255,255,0.05)") : "transparent",
                    border: "none",
                    borderRadius: 6,
                    color: t.text,
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <span>{e.name}</span>
                  {e.id === engineerId && (
                    <span style={{ color: t.accent, fontSize: 11, fontWeight: 700 }}>측측</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 월 측측 */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "8px 14px",
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
        }}>
          <button onClick={prevMonth} style={navBtnStyle(t)} aria-label="이전 달">
            <ChevronLeft size={18}/>
          </button>
          <div style={{
            fontSize: 15, fontWeight: 800, color: t.text,
            minWidth: 110, textAlign: "center",
          }}>
            {safeYear}년 {safeMonth}월
          </div>
          <button onClick={nextMonth} style={navBtnStyle(t)} aria-label="다음 달">
            <ChevronRight size={18}/>
          </button>
        </div>
        <div style={{
          marginTop: 6, fontSize: 10, color: t.textMuted, textAlign: "center", fontWeight: 600,
        }}>
          이 달 {monthTotal.cnt}건 · 세척 {monthTotal.cleaning} · 냉매 {monthTotal.refrigerant}
        </div>
      </div>

      {/* 월 격자 */}
      <div style={{ padding: "10px 16px 0" }}>
        {/* 측측 헤더 */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4, marginBottom: 4,
        }}>
          {WEEKDAYS.map((w, i) => (
            <div key={w} style={{
              textAlign: "center", fontSize: 10, fontWeight: 700,
              color: i === 0 ? "#EF4444" : i === 6 ? "#3B82F6" : t.textMuted,
              padding: "4px 0",
            }}>{w}</div>
          ))}
        </div>
        {/* 측측 cells */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}>
          {monthGrid.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} style={{ aspectRatio: "1 / 1.1" }}/>;
            }
            const tasks = tasksByDate[cell.ymd] || [];
            const isToday    = cell.ymd === todayKst;
            const isSelected = cell.ymd === safeSelectedYmd;
            const dow = idx % 7;
            const dayColor = dow === 0 ? "#EF4444" : dow === 6 ? "#3B82F6" : t.text;
            const cls = classifyByService(tasks);

            return (
              <button
                key={cell.ymd}
                onClick={() => setSelectedYmd(cell.ymd)}
                style={{
                  aspectRatio: "1 / 1.1",
                  background: isSelected
                    ? (t.accent + "22")
                    : (isToday ? (t.bgInset || "rgba(255,255,255,0.04)") : t.bgElevated),
                  border: `1px solid ${isSelected ? t.accent : (isToday ? t.accent + "55" : t.border)}`,
                  borderRadius: 8,
                  padding: "4px 4px 3px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex", flexDirection: "column",
                  alignItems: "stretch", justifyContent: "space-between",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: isToday ? 800 : 700,
                  color: dayColor, textAlign: "left",
                }}>{cell.day}</div>

                {/* 측측 점 + 측측 */}
                <DotsRow t={t} cls={cls} total={tasks.length}/>
              </button>
            );
          })}
        </div>
      </div>

      {/* 측측 측측 */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>
            {fmtDayLabel(safeSelectedYmd)}
          </span>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
            {dayTasks.length}건
          </span>
        </div>

        {dayTasks.length === 0 ? (
          <div style={{
            padding: "18px 14px", textAlign: "center",
            color: t.textMuted, fontSize: 12,
            background: t.bgElevated, border: `1px solid ${t.border}`,
            borderRadius: 10,
          }}>이 날 일정 없음</div>
        ) : (
          <div style={{
            background: t.bgElevated, border: `1px solid ${t.border}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            {dayTasks.map((task, idx) => {
              const svc = getTaskService(task);
              const svcColor = svc === "cleaning" ? COLOR_CLEANING
                             : svc === "refrigerant" ? COLOR_REFRIGERANT
                             : COLOR_OTHER;
              const svcLabel = svc === "cleaning" ? "세척"
                             : svc === "refrigerant" ? "냉매"
                             : "기타";
              const time = fmtTime(task.scheduledAt || task.scheduled_at);
              return (
                <button
                  key={task.id || idx}
                  onClick={() => onTaskClick && onTaskClick(task)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
                    background: "transparent",
                    border: "none",
                    borderTopColor: idx === 0 ? "transparent" : t.border,
                    cursor: "pointer", fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  {/* 측측 dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: svcColor, flexShrink: 0,
                  }}/>
                  {/* 시간 */}
                  <span className="mono" style={{
                    fontSize: 12, fontWeight: 700, color: t.text,
                    minWidth: 44,
                  }}>{time}</span>
                  {/* 본문 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: t.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{task.customer || "(고객명 없음)"}</div>
                    <div style={{
                      fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{shortRegion(task) || "지역 없음"}</div>
                  </div>
                  {/* 측측 라벨 */}
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: svcColor,
                    padding: "2px 7px",
                    background: svcColor + "1A",
                    borderRadius: 999,
                    flexShrink: 0,
                  }}>{svcLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 측측 (= 측측). */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "flex", gap: 14, fontSize: 10, color: t.textMuted, fontWeight: 600, justifyContent: "center" }}>
          <LegendDot color={COLOR_CLEANING}    label="세척"/>
          <LegendDot color={COLOR_REFRIGERANT} label="냉매"/>
          <LegendDot color={COLOR_OTHER}       label="기타"/>
        </div>
      </div>
    </div>
  );
}

function DotsRow({ t, cls, total }) {
  // 측측 측측 측측 점 측측 (최대 3개 측측). 측측 +N.
  const dots = [];
  for (let i = 0; i < Math.min(cls.cleaning, 3); i++)    dots.push(COLOR_CLEANING);
  for (let i = 0; i < Math.min(cls.refrigerant, 3); i++) dots.push(COLOR_REFRIGERANT);
  for (let i = 0; i < Math.min(cls.other, 3); i++)       dots.push(COLOR_OTHER);
  const visible = dots.slice(0, 3);
  const extra = total - visible.length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
      {visible.map((c, i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: c,
        }}/>
      ))}
      {extra > 0 && (
        <span style={{
          fontSize: 8, fontWeight: 700, color: t.textMuted, marginLeft: 1,
        }}>+{extra}</span>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }}/>
      {label}
    </span>
  );
}

function navBtnStyle(t) {
  return {
    background: "transparent",
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    color: t.text,
    display: "flex", alignItems: "center",
    fontFamily: "inherit",
  };
}

function fmtYmdShort(ymd) {
  // 'YYYY-MM-DD' → 'M/D' (= 측측 측측 측측 측측).
  if (!ymd) return "";
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function HighlightText({ text, query, t }) {
  // 측측측 측측 측측 measure (= bold + accent).
  if (!query) return text;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match  = text.slice(idx, idx + query.length);
  const after  = text.slice(idx + query.length);
  return (
    <>
      {before}
      <span style={{ background: t.accent + "33", color: t.accent, borderRadius: 3, padding: "0 2px" }}>{match}</span>
      {after}
    </>
  );
}

function fmtDayLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = WEEKDAYS[dt.getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

function fmtTime(isoStr) {
  if (!isoStr) return "--:--";
  // ISO/timestamp → KST HH:MM (= toKstYmd 측측 측측 측측 시간 측측).
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "--:--";
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mm = String(kst.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch { return "--:--"; }
}

function shortRegion(task) {
  // 측측 address 측측 측측 측측 측측 측측 (= 측측 + 측측).
  const addr = task.address || task.customerAddress || "";
  if (!addr) return "";
  const parts = String(addr).split(/\s+/);
  return parts.slice(0, 2).join(" ");
}

export default EngineerCalendarScreen;
