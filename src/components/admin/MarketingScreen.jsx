// 2026-07-24 — 마케팅 조감 화면 (운영자 PC).
//   1단계 (이 파일): DB 기반 3블록.
//     ① 홈페이지 접수 퍼널  — 접수 → 성사(전환) → 완료 + 취소율.
//        판별: converted inquiries.task_id 기반 (v3, Mig 152 이후만 정확).
//        기간: inquiries.created_at (접수 시각) KST 기준.
//     ② 완료 매출·회사이익  — 홈페이지 유입 완료 작업만 필터해서 computeRevenueByYmRange 재사용.
//        기간: task.completed_at (완료 시각) KST 기준.
//     ③ 지역 top5           — 홈페이지 유입 task 의 주소를 parseRegion 로 집계, 총 건수 내림차순 top5.
//        기간: task.created_at (접수 시각) KST 기준.
//   2단계 (별도 커밋): 네이버 검색광고 API → 지출/클릭/CPC + CPA vs 회사이익 게이지.
//     환경변수 세팅 후 api/ad-report.js 신설 예정.

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { parseRegion } from "../../utils/regionParser.js";
import { computeRevenueByYmRange } from "../../utils/revenueStats.js";
import { canSeeField } from "../../data/permissions.js";

const PERIOD_OPTS = [
  { id: "today", label: "오늘" },
  { id: "week",  label: "이번주" },
  { id: "month", label: "이번달" },
];

function _startOfWeekMonYmd() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _startOfMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function _rangeForPeriod(period) {
  const today = todayYmd();
  if (period === "today") return { start: today,                end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(), end: today };
  if (period === "month") return { start: _startOfMonthYmd(),   end: today };
  return { start: today, end: today };
}

function _fmtKRW(n) {
  return Number(n || 0).toLocaleString("ko-KR");
}
function _pctText(num, den) {
  if (!den) return "0.0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

export function MarketingScreen({ t, apiTasks = [], user, onBack }) {
  // 2026-07-25 — 기본 "이번달". "오늘"이면 오늘 접수→오늘 완료가 사실상 없어 항상 N/0/0 표기됨.
  const [period, setPeriod] = useState("month");
  // 2026-07-25 — 스팸 포함 모든 status (null = 전체) 를 1회 호출로. 클라에서 status 별 분류.
  const [allInquiries, setAllInquiries] = useState([]);
  // converted inquiries 의 task_id Set — 홈페이지 유입 task 판별 진실 소스 (v3).
  const [homepageTaskIds, setHomepageTaskIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const actorId = user?.user_id || user?.id;
    if (!actorId) {
      setAllInquiries([]);
      setHomepageTaskIds(new Set());
      setLoading(false);
      return () => { alive = false; };
    }
    listInquiries(actorId, null).then(rows => {
      if (!alive) return;
      const list = rows || [];
      setAllInquiries(list);
      const ids = new Set();
      for (const r of list) {
        if (r.status === "converted" && r.task_id) ids.add(String(r.task_id));
      }
      setHomepageTaskIds(ids);
      setLoading(false);
    }).catch(e => {
      if (!alive) return;
      setError(String(e?.message || e));
      setAllInquiries([]);
      setHomepageTaskIds(new Set());
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.user_id, user?.id]);

  const { start, end } = useMemo(() => _rangeForPeriod(period), [period]);

  // ── 블록 ① — 접수 퍼널 (기간: inquiries.created_at 기준) ─────────────────────
  //   총 접수(스팸 포함) → 유효(converted) → 완료. 스팸률 별도 표기.
  //   new/contacted 는 구조적으로 0(운영 흐름상 즉시 converted/spam) — "전환율" 지표 폐기.
  const funnel = useMemo(() => {
    const inRange = (allInquiries || []).filter(x => {
      const c = x.created_at || x.createdAt;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const total     = inRange.length;
    const spam      = inRange.filter(x => x.status === "spam").length;
    const converted = inRange.filter(x => x.status === "converted" && x.task_id);
    // converted → 실제 task 조회. status 로 완료/취소 판정.
    const taskById = new Map();
    for (const t2 of (apiTasks || [])) {
      if (t2 && t2.id) taskById.set(String(t2.id), t2);
    }
    let completed = 0;
    let canceled  = 0;
    for (const cv of converted) {
      const tk = taskById.get(String(cv.task_id));
      if (!tk) continue;
      const st = tk.status || "";
      // 2026-07-25 — 취소를 먼저 배제. DB에 status='취소'인데 completed_at 이 남은 task 18건 실재 →
      //   기존 (st === "완료" || tk.completedAt || tk.completed_at) 이 취소를 완료로 이중 계상.
      if (st === "취소") { canceled += 1; continue; }
      if (st === "완료" || tk.completedAt || tk.completed_at) completed += 1;
    }
    return {
      total,
      spam,
      valid: converted.length,
      completed,
      canceled,
    };
  }, [allInquiries, apiTasks, start, end]);

  // ── 블록 ② — 완료 매출·회사이익 (기간: completed_at 기준) ────────────────────
  //   apiTasks 를 homepageTaskIds 로 미리 필터 → computeRevenueByYmRange 통과.
  const revenue = useMemo(() => {
    if (!canSeeField(user, "task.total_amount")) return null;
    const filtered = (apiTasks || []).filter(t2 => t2 && t2.id && homepageTaskIds.has(String(t2.id)));
    return computeRevenueByYmRange(filtered, start, end, user);
  }, [apiTasks, homepageTaskIds, start, end, user]);

  // ── 블록 ③ — 지역 top5 (기간: task.created_at 기준, 홈페이지 유입만) ────────
  //   2026-07-25 — "미상"(주소 파싱 실패) 은 순위에서 제외하고 하단에 별도 표기.
  const regionTop5 = useMemo(() => {
    const tasksInRange = (apiTasks || []).filter(x => {
      if (!x || x.status === "취소") return false;
      if (!homepageTaskIds.has(String(x.id))) return false;
      const c = x.createdAt || x.created_at || x.receivedAt || x.received_at;
      if (!c) return false;
      const k = toKstYmd(c);
      return k && k >= start && k <= end;
    });
    const map = new Map();
    let unknown = 0;
    for (const tk of tasksInRange) {
      const addr = tk.address || tk.fullAddress || tk.주소 || "";
      const { key, label } = parseRegion(addr);
      if (key === "미상") { unknown += 1; continue; }
      if (!map.has(key)) map.set(key, { key, label, count: 0 });
      map.get(key).count += 1;
    }
    const sorted = [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const rankedTotal = tasksInRange.length - unknown;
    return { rows: sorted.slice(0, 5), total: rankedTotal, unknown, grandTotal: tasksInRange.length };
  }, [apiTasks, homepageTaskIds, start, end]);

  const cancelRate = funnel.valid > 0
    ? _pctText(funnel.canceled, funnel.valid)
    : "-";
  const spamRate = funnel.total > 0
    ? _pctText(funnel.spam, funnel.total)
    : "-";

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
          📈 마케팅 조감
        </div>
      </div>

      {/* 기간 필터 */}
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIOD_OPTS.map(opt => {
            const on = period === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                style={{
                  padding: "6px 14px",
                  background: on ? t.accent : "transparent",
                  border: `1px solid ${on ? t.accent : t.border}`,
                  borderRadius: 999,
                  color: on ? "#fff" : t.textSecondary,
                  fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 8 }}>
          {start === end ? `${start} (하루)` : `${start} ~ ${end}`} · KST
        </div>
        {/* v3 안내 문구 (원청 기준 금지 + 2026-06-28 이후만 정확) */}
        <div style={{
          fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 6,
          padding: "6px 10px",
          background: t.bgInset || "rgba(148, 163, 184, 0.08)",
          borderRadius: 6,
          lineHeight: 1.5,
        }}>
          ⓘ 홈페이지 유입 판별: 접수함 <b>converted 상태 inquiries.task_id</b> 기반 (v3).
          원청 코드 기준(v2) 은 폐기. <b>2026-06-28 (Mig 152) 이전 전환분은 소급 불가</b> — 그 이전 데이터는 홈페이지 유입 여부 판정 불가.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
          불러오는 중…
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 12 }}>
          조회 실패: {error}
        </div>
      ) : (
        <div style={{
          padding: "12px 16px 20px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 12,
        }}>
          {/* ① 홈페이지 접수 퍼널 */}
          <Panel t={t} title="① 홈페이지 접수 퍼널" subtitle="기간: 접수(inquiry.created_at) 기준">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}>
              <FunnelStep t={t} label="총 접수 (스팸 포함)" value={funnel.total} accent/>
              <FunnelStep t={t} label="유효 (converted)"    value={funnel.valid}/>
              <FunnelStep t={t}
                label="완료"
                value={funnel.completed}
                sub={funnel.valid > 0 ? _pctText(funnel.completed, funnel.valid) + " 완료율" : null}
              />
            </div>
            <div style={{
              marginTop: 12,
              padding: "8px 12px",
              background: t.bgInset || "rgba(148, 163, 184, 0.06)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>스팸률 (총 접수 대비)</span>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 800,
                color: funnel.spam > 0 ? "#6B7280" : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {spamRate} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                  ({funnel.spam}건)
                </span>
              </span>
            </div>
            <div style={{
              marginTop: 6,
              padding: "8px 12px",
              background: t.bgInset || "rgba(148, 163, 184, 0.06)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>취소율 (유효 대비)</span>
              <span className="mono" style={{
                fontSize: 15, fontWeight: 800,
                color: funnel.canceled > 0 ? "#DC2626" : t.text,
                fontVariantNumeric: "tabular-nums",
              }}>
                {cancelRate} <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 4 }}>
                  ({funnel.canceled}건)
                </span>
              </span>
            </div>
          </Panel>

          {/* ② 완료 매출·회사이익 */}
          <Panel t={t} title="② 완료 매출 · 회사이익" subtitle="기간: 완료(task.completed_at) 기준 · 홈페이지 유입만 · ①의 완료와 집계 기준이 다름(완료 시각 기준)">
            {revenue == null ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                매출 조회 권한 없음
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}>
                <Metric t={t} label="완료 건수"  value={revenue.count}/>
                <Metric t={t} label="완료 매출"  value={_fmtKRW(revenue.total)} suffix="원" accent/>
                <Metric t={t} label="회사 이익"  value={_fmtKRW(revenue.owner)} suffix="원"
                        highlight={revenue.owner > 0 ? "#16A34A" : (revenue.owner < 0 ? "#DC2626" : null)}/>
              </div>
            )}
          </Panel>

          {/* ③ 지역 top5 */}
          <Panel t={t} title="③ 지역 top5" subtitle="기간: 접수(task.created_at) 기준 · 홈페이지 유입만 · 주소 파싱 실패(미상)는 순위 제외">
            {regionTop5.grandTotal === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                이 기간 홈페이지 유입 없음
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {regionTop5.rows.map((r, idx) => {
                  const pct = regionTop5.total > 0 ? (r.count / regionTop5.total) * 100 : 0;
                  return (
                    <div key={r.key} style={{
                      display: "grid",
                      gridTemplateColumns: "28px minmax(0, 1fr) 60px",
                      gap: 10, alignItems: "center",
                      padding: "8px 4px",
                    }}>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 800,
                        color: idx === 0 ? t.accent : t.textMuted,
                        textAlign: "center",
                      }}>{idx + 1}</span>
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 3,
                        minWidth: 0,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{r.label}</span>
                        <div style={{
                          height: 4, background: t.bgInset || "rgba(148, 163, 184, 0.15)",
                          borderRadius: 2, overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${pct.toFixed(1)}%`, height: "100%",
                            background: t.accent, borderRadius: 2,
                          }}/>
                        </div>
                      </div>
                      <span className="mono" style={{
                        fontSize: 13, fontWeight: 800, color: t.text,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}>{r.count} <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>건</span></span>
                    </div>
                  );
                })}
                {regionTop5.rows.length === 0 && (
                  <div style={{ padding: "12px 4px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                    이 기간 순위 대상 없음 (전부 주소 미상)
                  </div>
                )}
                {regionTop5.unknown > 0 && (
                  <div style={{
                    marginTop: 4,
                    padding: "6px 4px",
                    borderTop: `1px dashed ${t.border}`,
                    display: "flex", justifyContent: "space-between",
                    fontSize: 11, color: t.textMuted, fontWeight: 700,
                  }}>
                    <span>주소 미상 (순위 제외)</span>
                    <span className="mono" style={{ color: t.text }}>{regionTop5.unknown}건</span>
                  </div>
                )}
                <div style={{
                  marginTop: 4,
                  padding: "6px 4px",
                  borderTop: `1px solid ${t.border}`,
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: t.textMuted, fontWeight: 700,
                }}>
                  <span>홈페이지 유입 합계</span>
                  <span className="mono" style={{ color: t.text }}>{regionTop5.grandTotal}건</span>
                </div>
              </div>
            )}
          </Panel>

          {/* 2단계 예약 안내 (광고 API 미연동 상태 표시) */}
          <Panel t={t} title="④ 광고 지출·CPA (2단계 — 미연동)" subtitle="네이버 검색광고 API 연동 필요">
            <div style={{
              padding: "18px 14px", textAlign: "center",
              color: t.textMuted, fontSize: 12, fontWeight: 600, lineHeight: 1.6,
            }}>
              환경변수 세팅 후 활성화 예정:<br/>
              <span className="mono" style={{
                fontSize: 11, color: t.textSecondary, letterSpacing: "-0.2px",
              }}>NAVER_AD_API_KEY / NAVER_AD_SECRET / NAVER_AD_CUSTOMER_ID</span>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ t, title, subtitle, children }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "14px 14px 12px",
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: "-0.2px" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function Metric({ t, label, value, suffix, accent, highlight }) {
  const color = highlight || (accent ? t.accent : t.text);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "10px 12px",
      background: t.bgInset || "rgba(148, 163, 184, 0.05)",
      borderRadius: 8,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 16, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
        {suffix && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginLeft: 2 }}>{suffix}</span>}
      </span>
    </div>
  );
}

function FunnelStep({ t, label, value, sub, accent }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "12px 12px",
      background: accent ? (t.accentBg || "rgba(255, 27, 141, 0.08)") : (t.bgInset || "rgba(148, 163, 184, 0.05)"),
      border: `1px solid ${accent ? t.accent : "transparent"}`,
      borderRadius: 10,
      textAlign: "center",
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 22, fontWeight: 800,
        color: accent ? t.accent : t.text,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px",
      }}>{Number(value || 0).toLocaleString("ko-KR")}</span>
      {sub && (
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{sub}</span>
      )}
    </div>
  );
}

export default MarketingScreen;
