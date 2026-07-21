// 2026-07-21 v2 — 사용자 화면 재설계 (사장님 spec: "편하게").
//   · 데이터 소스 교체: loadUsers()(localStorage 캐시 — DB 변경 반영 안 됨) → listUsersFromDb() (Supabase 직결).
//     실패(오프라인 등) 시 옛 loadUsers() fallback + 경고 배지.
//   · PC(1024px+): 테이블 레이아웃 (이름/역할/전화(로그인)/상태) — 행 클릭 = 편집.
//   · 모바일: 카드 리스트 유지.
//   · 검색(이름/전화/아이디) + 역할 필터 + 비활성 숨김 토글(기본 활성만 — 사용 편의).
import { useState, useMemo, useEffect } from "react";
import { loadUsers, ROLES } from "../data/users.js";
import { listUsersFromDb } from "../lib/usersDb.js";

const FILTERS = [
  { key: "all",       label: "전체" },
  { key: "owner",     label: "대표" },
  { key: "admin",     label: "관리자" },
  { key: "happycall", label: "해피콜" },
  { key: "engineer",  label: "기사" },
  { key: "principal", label: "원청" },
];

function useIsPc() {
  const [isPc, setIsPc] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = (e) => setIsPc(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn);
    };
  }, []);
  return isPc;
}

export function UserListScreen({ onBack, onAdd, onEdit }) {
  const isPc = useIsPc();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);  // DB 실패 → 캐시 fallback 표시
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [showInactive, setShowInactive] = useState(false);  // 기본: 활성만

  useEffect(() => {
    let alive = true;
    listUsersFromDb().then(res => {
      if (!alive) return;
      if (res.ok) {
        setUsers(res.users);
      } else {
        // DB 실패 — 옛 캐시로 fallback (읽기 전용 참고용)
        setUsers(loadUsers());
        setFromCache(true);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (!showInactive && !u.active) return false;
      if (filter !== "all") {
        // roles 배열 있으면 다중 역할까지 매칭 (DB), 없으면 단일 role (캐시)
        const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role];
        if (!roles.includes(filter)) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const inName    = (u.name || "").includes(search);
        const inLoginId = (u.loginId || "").toLowerCase().includes(s);
        const inPhone   = (u.phone || "").replace(/-/g, "").includes(search.replace(/-/g, ""));
        if (!inName && !inLoginId && !inPhone) return false;
      }
      return true;
    });
  }, [users, search, filter, showInactive]);

  const counts = useMemo(() => {
    const c = { active: 0, inactive: 0 };
    users.forEach(u => u.active ? c.active++ : c.inactive++);
    return c;
  }, [users]);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>사용자</div>
        <button onClick={onAdd} style={addBtnStyle}>+ 추가</button>
      </div>

      <div style={{ padding: isPc ? "20px 28px" : "14px 16px", maxWidth: 1120, margin: "0 auto" }}>
        {/* 상단 툴바 — 검색 / 역할 필터 / 비활성 토글 / 카운트 */}
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
          marginBottom: 14,
        }}>
          <input
            type="text" placeholder="🔍 이름 · 전화 · 아이디"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...searchStyle, flex: isPc ? "0 1 260px" : "1 1 100%" }}
          />
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {FILTERS.map(f => (
              <div key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: "7px 12px",
                  background: "var(--bg-secondary)",
                  border: filter === f.key ? "2px solid var(--accent, #FF1B8D)" : "1px solid var(--border)",
                  borderRadius: 7, fontSize: 12,
                  color: filter === f.key ? "var(--accent, #FF1B8D)" : "var(--text-secondary)",
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontWeight: filter === f.key ? 700 : 500,
                }}>
                {f.label}
              </div>
            ))}
          </div>
          <label style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "var(--text-secondary)", cursor: "pointer",
            marginLeft: "auto", userSelect: "none", whiteSpace: "nowrap",
          }}>
            <input type="checkbox" checked={showInactive} onChange={() => setShowInactive(v => !v)}/>
            비활성 표시 ({counts.inactive})
          </label>
        </div>

        {fromCache && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 8,
            background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)",
            fontSize: 11, color: "var(--text-primary)",
          }}>
            ⚠️ DB 연결 실패 — 저장된 캐시 목록을 표시 중입니다 (최신 아닐 수 있음).
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-secondary)", fontSize: 12 }}>
            불러오는 중...
          </div>
        ) : isPc ? (
          /* ── PC 테이블 ── */
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated, var(--bg-secondary))" }}>
                  <Th>이름</Th>
                  <Th>역할</Th>
                  <Th>전화 (로그인)</Th>
                  <Th style={{ textAlign: "center", width: 90 }}>상태</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const role = ROLES[u.role] || { name: u.role, color: "var(--text-secondary)" };
                  return (
                    <tr key={u.id || u.loginId}
                      onClick={() => onEdit(u)}
                      style={{
                        cursor: "pointer",
                        borderTop: "1px solid var(--border)",
                        background: "var(--bg-secondary)",
                        opacity: u.active ? 1 : 0.55,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary, var(--bg-elevated))"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
                    >
                      <td style={{ padding: "11px 14px", fontWeight: 700 }}>
                        <span style={{
                          display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                          background: role.color, marginRight: 8, verticalAlign: 1,
                        }}/>
                        {u.name}
                        <span style={{ marginLeft: 8, fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 500 }}>
                          @{u.loginId}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{
                          background: "var(--bg-tertiary, var(--bg-elevated))", color: role.color,
                          fontSize: 11, padding: "3px 8px", borderRadius: 5, fontWeight: 700,
                        }}>{role.name}</span>
                      </td>
                      <td style={{ padding: "11px 14px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {u.phone || "—"}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: u.active ? "#00875A" : "var(--text-tertiary)",
                        }}>{u.active ? "활성" : "비활성"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 12 }}>
                결과 없음
              </div>
            )}
          </div>
        ) : (
          /* ── 모바일 카드 ── */
          <div>
            {filtered.map(u => (
              <UserRow key={u.id || u.loginId} user={u} onClick={() => onEdit(u)}/>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                결과 없음
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{
      padding: "10px 14px", textAlign: "left",
      fontSize: 11, fontWeight: 800, color: "var(--text-secondary)",
      ...style,
    }}>{children}</th>
  );
}

function UserRow({ user: u, onClick }) {
  const role = ROLES[u.role] || { name: u.role, color: "var(--text-secondary)" };
  return (
    <div onClick={onClick} style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "12px 14px", marginBottom: 8, cursor: "pointer",
      opacity: u.active ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: role.color,
          flexShrink: 0,
        }}/>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{u.name}</span>
        <span style={{
          background: "var(--bg-tertiary)", color: role.color,
          fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
        }}>{role.name}</span>
        <span style={{
          marginLeft: "auto", fontSize: 11,
          color: u.active ? "#00875A" : "var(--text-secondary)", fontWeight: 500,
        }}>{u.active ? "활성" : "비활성"}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        {u.phone ? `${u.phone} · ` : ""}@{u.loginId}
      </div>
    </div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 700 };
const addBtnStyle = {
  background: "var(--accent, #FF1B8D)", border: "none", color: "#fff",
  fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const searchStyle = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

export default UserListScreen;
