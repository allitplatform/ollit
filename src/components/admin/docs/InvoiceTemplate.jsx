// 2026-06-19 Step 4 — 거래명세서 A4 양식 (사장님 시안 매칭).
//
// A4 793 × 1122 px @ 96dpi. html2canvas scale 2 캡처 → jsPDF A4 임베드.
// 본 컴포넌트는 화면 노출 X — 부모가 offscreen mount 후 캡처만 하고 unmount.
//
// 시안 (사장님 2026-06-19 스샷):
//   · 진한 파랑 헤더 (#4B72BB 계열) + 흰 글씨
//   · 라벨 좌측 라이트 블루 (#DCE6F4)
//   · 합계 강조: 노란빛 배경 (#FFF6D6) + 빨간 글씨 (#C00000)
//   · 서브 항목 "└" 들여쓰기, 비고 컬럼 분리
//   · 입금계좌 안내 / 안내사항 둘 다 ■ 표시 좌상단 + 내부 영역

const A4_W = 793;
const A4_H = 1122;

const C_HEADER_BG    = "#4B72BB";
const C_HEADER_FG    = "#FFFFFF";
const C_LABEL_BG     = "#DCE6F4";
const C_HIGHLIGHT_BG = "#FFF6D6";
const C_HIGHLIGHT_FG = "#C00000";
const C_BORDER       = "#BCBCBC";
const C_BORDER_DARK  = "#7A7A7A";
const C_TEXT         = "#1A1A1A";
const C_MUTED        = "#666666";

const s = {
  page: {
    width:  `${A4_W}px`,
    height: `${A4_H}px`,
    background: "#FFFFFF",
    color: C_TEXT,
    fontFamily: "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif",
    boxSizing: "border-box",
    padding: "36px 42px",
    position: "relative",
    fontSize: 12,
  },
  title: {
    textAlign: "center",
    fontSize: 38,
    fontWeight: 800,
    letterSpacing: "0.45em",
    paddingLeft: "0.45em",
    marginBottom: 28,
    color: C_TEXT,
  },

  // ── 상단 안내 줄
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  topLeftBox: {
    border: `1px solid ${C_BORDER}`,
    fontSize: 12,
  },
  topRowLine: {
    display: "flex",
    borderBottom: `1px solid ${C_BORDER}`,
  },
  topRowLineLast: {
    display: "flex",
  },
  topLabel: {
    width: 70,
    padding: "5px 10px",
    background: C_LABEL_BG,
    borderRight: `1px solid ${C_BORDER}`,
    fontWeight: 600,
    letterSpacing: "0.1em",
  },
  topValue: {
    width: 230,
    padding: "5px 10px",
  },
  topRightText: {
    paddingTop: 6,
    fontSize: 13,
    color: C_TEXT,
  },

  // ── 공급받는자 / 공급자 2단
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    border: `1px solid ${C_BORDER}`,
    marginBottom: 14,
  },
  partyHeader: {
    background: C_HEADER_BG,
    color: C_HEADER_FG,
    fontWeight: 700,
    fontSize: 12,
    textAlign: "center",
    padding: "6px 0",
    letterSpacing: "0.4em",
    paddingLeft: "0.4em",
    borderBottom: `1px solid ${C_BORDER}`,
  },
  partyHeaderRight: {
    background: C_HEADER_BG,
    color: C_HEADER_FG,
    fontWeight: 700,
    fontSize: 12,
    textAlign: "center",
    padding: "6px 0",
    letterSpacing: "0.4em",
    paddingLeft: "0.4em",
    borderBottom: `1px solid ${C_BORDER}`,
    borderLeft: `1px solid ${C_BORDER}`,
  },
  partyCol: {},
  partyColRight: {
    borderLeft: `1px solid ${C_BORDER}`,
  },
  partyRow: {
    display: "flex",
    borderBottom: `1px solid ${C_BORDER}`,
    minHeight: 30,
  },
  partyRowLast: {
    display: "flex",
    minHeight: 30,
  },
  partyLabel: {
    width: 70,
    padding: "6px 8px",
    background: C_LABEL_BG,
    borderRight: `1px solid ${C_BORDER}`,
    fontWeight: 600,
    letterSpacing: "0.2em",
    flexShrink: 0,
    color: C_TEXT,
  },
  partyValue: {
    flex: 1,
    padding: "6px 10px",
    color: C_TEXT,
    wordBreak: "break-all",
    lineHeight: 1.4,
  },

  // ── 합계 강조 (품목표 위)
  grandBox: {
    display: "flex",
    border: `1px solid ${C_BORDER}`,
    marginBottom: 12,
  },
  grandLabel: {
    width: 280,
    background: C_HIGHLIGHT_BG,
    padding: "12px 16px",
    textAlign: "center",
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: "0.2em",
    borderRight: `1px solid ${C_BORDER}`,
    color: C_TEXT,
  },
  grandValue: {
    flex: 1,
    background: C_HIGHLIGHT_BG,
    padding: "12px 16px",
    textAlign: "center",
    fontWeight: 800,
    fontSize: 16,
    color: C_HIGHLIGHT_FG,
    letterSpacing: "0.05em",
  },

  // ── 품목표
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    marginBottom: 12,
  },
  th: {
    background: C_HEADER_BG,
    color: C_HEADER_FG,
    fontWeight: 700,
    padding: "8px 6px",
    border: `1px solid ${C_BORDER_DARK}`,
    textAlign: "center",
    letterSpacing: "0.2em",
  },
  td: {
    border: `1px solid ${C_BORDER}`,
    padding: "7px 8px",
    color: C_TEXT,
    verticalAlign: "middle",
  },
  tdNum: {
    border: `1px solid ${C_BORDER}`,
    padding: "7px 8px",
    textAlign: "right",
    fontFamily: "monospace",
    color: C_TEXT,
  },
  tdCenter: {
    border: `1px solid ${C_BORDER}`,
    padding: "7px 8px",
    textAlign: "center",
    color: C_TEXT,
  },
  subItemCell: {
    border: `1px solid ${C_BORDER}`,
    padding: "5px 8px 5px 22px",
    color: C_MUTED,
    fontSize: 11,
  },

  // ── 하단 합계 표
  totalTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    marginBottom: 14,
  },
  totalLabel: {
    background: C_LABEL_BG,
    padding: "8px 10px",
    border: `1px solid ${C_BORDER}`,
    textAlign: "center",
    fontWeight: 700,
    letterSpacing: "0.25em",
  },
  totalValue: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 12px",
    textAlign: "right",
    fontFamily: "monospace",
    color: C_TEXT,
  },
  totalUnit: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 10px",
    width: 40,
    textAlign: "center",
    color: C_TEXT,
  },
  totalLabelGrand: {
    background: C_HIGHLIGHT_BG,
    padding: "10px",
    border: `1px solid ${C_BORDER}`,
    textAlign: "center",
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: "0.4em",
  },
  totalValueGrand: {
    background: C_HIGHLIGHT_BG,
    border: `1px solid ${C_BORDER}`,
    padding: "10px 12px",
    textAlign: "right",
    fontFamily: "monospace",
    color: C_HIGHLIGHT_FG,
    fontWeight: 800,
    fontSize: 14,
  },
  totalUnitGrand: {
    background: C_HIGHLIGHT_BG,
    border: `1px solid ${C_BORDER}`,
    padding: "10px",
    width: 40,
    textAlign: "center",
    color: C_HIGHLIGHT_FG,
    fontWeight: 800,
  },

  // ── 하단 정보 영역 (입금계좌 / 안내사항)
  bulletHeader: {
    fontSize: 13,
    fontWeight: 800,
    color: C_TEXT,
    marginBottom: 4,
    marginTop: 12,
    paddingLeft: 2,
  },
  infoBox: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 12px",
    fontSize: 12,
    color: C_TEXT,
    lineHeight: 1.7,
  },
  noticeBox: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 12px",
    fontSize: 11,
    color: C_TEXT,
    lineHeight: 1.7,
  },
  noticeLine: {
    display: "flex",
    gap: 8,
    paddingTop: 1,
    paddingBottom: 1,
  },
};

const fmt = (n) => `${(Number(n) || 0).toLocaleString("ko-KR")}`;

function kstTodayKor() {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const [y, m, day] = fmt.split("-");
  return `${y}년 ${m}월 ${day}일`;
}

function PartyRow({ label, value, isLast }) {
  return (
    <div style={isLast ? s.partyRowLast : s.partyRow}>
      <div style={s.partyLabel}>{label}</div>
      <div style={s.partyValue}>{value || ""}</div>
    </div>
  );
}

export default function InvoiceTemplate({
  issuer = {},      // 사업자 정보 row (engineer_business_info)
  recipient = {},   // { type, name, bizName, bizNo, address }
  items = [],       // [{ label, qty, price, subItems?: string[] }]
  vat = {},         // { supply, vat, total }
  vatMode = "inclusive",
  issuedAt,         // "YYYY년 MM월 DD일" — default 오늘 KST
}) {
  const dateStr = issuedAt || kstTodayKor();
  const isBusiness = recipient.type === "business";

  // 빈 행 채워 표 높이 일정.
  const MIN_ROWS = 7;
  const flatRows = [];
  items.forEach((it, idx) => {
    flatRows.push({ kind: "main", item: it, no: idx + 1 });
    if (Array.isArray(it.subItems)) {
      for (const sub of it.subItems) {
        flatRows.push({ kind: "sub", text: sub });
      }
    }
  });
  while (flatRows.length < MIN_ROWS) flatRows.push({ kind: "empty" });

  const isVatExclusive = vatMode === "exclusive";

  return (
    <div style={s.page}>
      <div style={s.title}>거 래 명 세 서</div>

      {/* 상단 정보 */}
      <div style={s.topRow}>
        <div style={s.topLeftBox}>
          <div style={s.topRowLine}>
            <div style={s.topLabel}>거래일자</div>
            <div style={s.topValue}>{dateStr}</div>
          </div>
          <div style={s.topRowLineLast}>
            <div style={s.topLabel}>인수확인</div>
            <div style={s.topValue}>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
          </div>
        </div>
        <div style={s.topRightText}>
          아래와 같이 거래내역을 통보합니다.
        </div>
      </div>

      {/* 공급받는자 / 공급자 */}
      <div style={s.twoCol}>
        <div style={s.partyHeader}>공급받는자</div>
        <div style={s.partyHeaderRight}>공급자</div>

        <div style={s.partyCol}>
          {isBusiness ? (
            <>
              <PartyRow label="상 호"   value={recipient.bizName}/>
              <PartyRow label="사업자번호" value={recipient.bizNo}/>
              <PartyRow label="주 소"   value={recipient.address} isLast/>
            </>
          ) : (
            <>
              <PartyRow label="성 명"   value={recipient.name}/>
              <PartyRow label="연락처"  value={recipient.phone}/>
              <PartyRow label="주 소"   value={recipient.address} isLast/>
            </>
          )}
        </div>

        <div style={s.partyColRight}>
          <PartyRow label="상 호"     value={issuer.business_name}/>
          <PartyRow label="대표자"    value={issuer.representative_name}/>
          <PartyRow label="사업자번호" value={issuer.business_no}/>
          <PartyRow label="주 소"     value={issuer.business_address} isLast/>
        </div>
      </div>

      {/* 합계 강조 (품목표 위) */}
      <div style={s.grandBox}>
        <div style={s.grandLabel}>
          합 계 금 액 ({isVatExclusive ? "VAT 별도" : "VAT 포함"})
        </div>
        <div style={s.grandValue}>
          금 {fmt(vat.total)} 원정 (₩{fmt(vat.total)})
        </div>
      </div>

      {/* 품목표 */}
      <table style={s.table}>
        <colgroup>
          <col style={{ width: 42 }}/>
          <col/>
          <col style={{ width: 56 }}/>
          <col style={{ width: 100 }}/>
          <col style={{ width: 110 }}/>
          <col style={{ width: 70 }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={s.th}>NO</th>
            <th style={s.th}>품 목</th>
            <th style={s.th}>수량</th>
            <th style={s.th}>단 가</th>
            <th style={s.th}>공 급 가액</th>
            <th style={s.th}>비 고</th>
          </tr>
        </thead>
        <tbody>
          {flatRows.map((r, i) => {
            if (r.kind === "empty") {
              return (
                <tr key={`e-${i}`}>
                  <td style={s.tdCenter}>&nbsp;</td>
                  <td style={s.td}>&nbsp;</td>
                  <td style={s.tdCenter}>&nbsp;</td>
                  <td style={s.tdNum}>&nbsp;</td>
                  <td style={s.tdNum}>&nbsp;</td>
                  <td style={s.tdCenter}>&nbsp;</td>
                </tr>
              );
            }
            if (r.kind === "sub") {
              return (
                <tr key={`s-${i}`}>
                  <td style={s.tdCenter}>&nbsp;</td>
                  <td style={s.subItemCell}>└ {r.text}</td>
                  <td style={s.tdCenter}>&nbsp;</td>
                  <td style={s.tdNum}>&nbsp;</td>
                  <td style={s.tdNum}>&nbsp;</td>
                  <td style={s.tdCenter}>&nbsp;</td>
                </tr>
              );
            }
            const it    = r.item;
            const qty   = Number(it.qty) || 1;
            const price = Number(it.price) || 0;
            const sub   = qty * price;
            return (
              <tr key={`m-${i}`}>
                <td style={s.tdCenter}>{r.no}</td>
                <td style={s.td}>{it.label || ""}</td>
                <td style={s.tdCenter}>{qty}</td>
                <td style={s.tdNum}>{price ? fmt(price) : ""}</td>
                <td style={s.tdNum}>{sub ? fmt(sub) : ""}</td>
                <td style={s.tdCenter}>{it.note || (sub ? "일체" : "")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 하단 합계 표 */}
      <table style={s.totalTable}>
        <colgroup>
          <col/>
          <col style={{ width: 140 }}/>
          <col style={{ width: 40 }}/>
        </colgroup>
        <tbody>
          <tr>
            <td style={s.totalLabel}>공 급 가 액</td>
            <td style={s.totalValue}>{fmt(vat.supply)}</td>
            <td style={s.totalUnit}>원</td>
          </tr>
          <tr>
            <td style={s.totalLabel}>부 가 세 (10%)</td>
            <td style={s.totalValue}>{fmt(vat.vat)}</td>
            <td style={s.totalUnit}>원</td>
          </tr>
          <tr>
            <td style={s.totalLabelGrand}>합 &nbsp; 계</td>
            <td style={s.totalValueGrand}>{fmt(vat.total)}</td>
            <td style={s.totalUnitGrand}>원</td>
          </tr>
        </tbody>
      </table>

      {/* 입금계좌 안내 */}
      <div style={s.bulletHeader}>■ 입금계좌 안내</div>
      <div style={s.infoBox}>
        {(issuer.bank_name || "—")} {(issuer.bank_account || "")}
        {"  (예금주: "}{issuer.business_name || issuer.representative_name || "—"}{")"}
      </div>

      {/* 안내사항 */}
      <div style={s.bulletHeader}>■ 안내사항</div>
      <div style={s.noticeBox}>
        <div style={s.noticeLine}><span>1.</span><span>본 거래명세서는 작업 완료 후 발행되었으며, 상기 내역대로 작업이 완료되었음을 확인합니다.</span></div>
        <div style={s.noticeLine}><span>2.</span><span>위 금액은 부가가치세(VAT) {isVatExclusive ? "별도" : "포함"} 금액 기준이며, 합계 금액은 VAT {isVatExclusive ? "별도" : "포함"} 금액입니다.</span></div>
        <div style={s.noticeLine}><span>3.</span><span>결제는 위 계좌로 입금 부탁드리며, 현장 결제도 가능합니다.</span></div>
        <div style={s.noticeLine}><span>4.</span><span>작업 관련 문의사항은 공급자({issuer.business_name || "—"})로 연락 주시기 바랍니다.</span></div>
      </div>
    </div>
  );
}
