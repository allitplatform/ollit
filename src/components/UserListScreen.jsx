// Step 9 — 사용자 / 권한 리스트
import { useState, useMemo } from "react";
import { loadUsers, ROLES } from "../data/users.js";

const FILTERS = [
  { key: "all",       label: "전체" },
  { key: "owner",     label: "대표" },
  { key: "admin",     label: "관리자" },
  { key: "happycall", label: "해피콜" },
  { key: "engineer",  label: "기사" },
  { key: "principal", label: "원청" },
];

export function UserListScreen({ onBack, onAdd, onEdit }) {
  const [users] = useState(() => loadUsers());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const s = search.toLowerCase();
        const inName    = u.name.includes(search);
        const inLoginId = (u.loginId || "").toLowerCase().includes(s);
        if (!inName && !inLoginId) return false;
      }
      if (filter !== "all" && u.role !== filter) return false;
      return true;
    });
  }, [users, search, filter]);

  const counts = useMemo(() => {
    const c = { active: 0, inactive: 0 };
    users.forEach(u => u.active ? c.active++ : c.inactive++);
    return c;
  }, [users]);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>사용자 / 권한</div>
        <button onClick={onAdd} style={addBtnStyle}>+ 추가</button>
      </div>

      <div style={{ padding: "14px 16px 8px", fontSize: 12 }}>
        <span style={{ color: "var(--text-primary)" }}>활동 <strong style={{ color: "#00875A" }}>{counts.active}</strong></span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>· 비활성 {counts.inactive}</span>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <input
          type="text" placeholder="🔍 이름 또는 아이디"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 6, padding: "0 16px 14px", overflowX: "auto" }}>
        {FILTERS.map(f => (
          <div key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 12px",
              background: "var(--bg-secondary)",
              border: filter === f.key ? "2px solid #FF1B8D" : "1px solid var(--border)",
              borderRadius: 7, fontSize: 12,
              color: filter === f.key ? "#FF1B8D" : "var(--text-secondary)",
              cursor: "pointer", whiteSpace: "nowrap",
              fontWeight: filter === f.key ? 700 : 500,
            }}>
            {f.label}
          </div>
        ))}
      </div>

      <div style={{ padding: "0 16px 24px" }}>
        {filtered.map(u => (
          <UserRow key={u.id} user={u} onClick={() => onEdit(u)}/>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            결과 없음
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({ user: u, onClick }) {
  const role = ROLES[u.role] || { name: u.role, color: "var(--text-secondary)" };
  return (
    <div onClick={onClick} style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "12px 14px", marginBottom: 8, cursor: "pointer",
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
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>
        @{u.loginId}
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
const titleStyle = { fontSize: 15, fontWeight: 500 };
const addBtnStyle = {
  background: "#FF1B8D", border: "none", color: "#fff",
  fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 6, cursor: "pointer",
  fontFamily: "inherit",
};
const searchStyle = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

export default UserListScreen;
