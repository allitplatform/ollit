// 2026-06-19 Step 4 — 영수증 A4 양식 (사장님 시안 매칭).
//
// 시안 (사장님 2026-06-19 스샷):
//   · 제목 "영 수 증" 가운데, 자간 큼
//   · 상단 3줄: 발행번호 / 영수일자 (한 줄 분할), 받는 분 + 귀하, 연락처
//   · 영수금액 강조 영역: 좌 회색 "영 수 금 액", 우 노란빛 2행
//       (1) "일금 OOOO 원정", (2) "(₩ N , N N N 원)"
//   · 품목표: 라이트블루 헤더, NO/내역/금액, 서브 항목 └ 들여쓰기
//   · 합계 행 빨간 글씨
//   · 가운데 굵은 문구 "위 금액을 정히 영수하였습니다."
//   · 발행처 영역: ■ 발행처 + 상호/대표자/사업자번호/주소/연락처

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
    padding: "40px 60px",
    position: "relative",
    fontSize: 12,
  },
  title: {
    textAlign: "center",
    fontSize: 42,
    fontWeight: 800,
    letterSpacing: "0.5em",
    paddingLeft: "0.5em",
    marginTop: 16,
    marginBottom: 44,
    color: C_TEXT,
  },

  // ── 상단 정보 (발행번호/영수일자/받는분/연락처)
  topTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    marginBottom: 22,
  },
  topLabel: {
    background: C_LABEL_BG,
    padding: "8px 10px",
    border: `1px solid ${C_BORDER}`,
    fontWeight: 700,
    textAlign: "center",
    width: 88,
    letterSpacing: "0.12em",
    color: C_TEXT,
    whiteSpace: "nowrap",
  },
  // 2026-06-19 — 영수일자 ("2026년 06월 19일") 가 좁은 셀에서 글자 단위
  //   줄바꿈("2026/년06/월19/일") 되던 사고 정정. white-space: nowrap +
  //   word-break: keep-all 로 한 줄 보장. label 폭 100→88 로 줄여 값 셀 확보.
  topVal: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 12px",
    color: C_TEXT,
    whiteSpace: "nowrap",
    wordBreak: "keep-all",
  },
  topValEnd: {
    background: C_LABEL_BG,
    padding: "8px 10px",
    border: `1px solid ${C_BORDER}`,
    fontWeight: 700,
    textAlign: "center",
    width: 50,
    letterSpacing: "0.2em",
    color: C_TEXT,
    whiteSpace: "nowrap",
  },

  // ── 영수금액 강조
  amountTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 28,
  },
  amountLabel: {
    width: 100,
    background: C_LABEL_BG,
    border: `1px solid ${C_BORDER}`,
    textAlign: "center",
    fontWeight: 800,
    fontSize: 14,
    padding: "20px 0",
    letterSpacing: "0.3em",
    color: C_TEXT,
    lineHeight: 1.4,
  },
  amountValRowTop: {
    background: C_HIGHLIGHT_BG,
    border: `1px solid ${C_BORDER}`,
    textAlign: "center",
    fontWeight: 800,
    fontSize: 22,
    color: C_HIGHLIGHT_FG,
    padding: "14px 12px",
    letterSpacing: "0.18em",
  },
  amountValRowBottom: {
    background: C_HIGHLIGHT_BG,
    border: `1px solid ${C_BORDER}`,
    textAlign: "center",
    fontWeight: 800,
    fontSize: 22,
    color: C_HIGHLIGHT_FG,
    padding: "14px 12px",
    letterSpacing: "0.18em",
  },

  // ── 품목표
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    marginBottom: 18,
  },
  th: {
    background: C_LABEL_BG,
    color: C_TEXT,
    fontWeight: 700,
    padding: "8px 6px",
    border: `1px solid ${C_BORDER}`,
    textAlign: "center",
    letterSpacing: "0.3em",
  },
  td: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 10px",
    color: C_TEXT,
  },
  tdCenter: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 6px",
    textAlign: "center",
    color: C_TEXT,
  },
  tdNum: {
    border: `1px solid ${C_BORDER}`,
    padding: "8px 12px",
    textAlign: "right",
    fontFamily: "monospace",
    color: C_TEXT,
  },
  tdSub: {
    border: `1px solid ${C_BORDER}`,
    padding: "5px 8px 5px 22px",
    color: C_MUTED,
    fontSize: 12,
  },
  totalLabel: {
    border: `1px solid ${C_BORDER}`,
    background: C_LABEL_BG,
    padding: "10px",
    textAlign: "center",
    fontWeight: 800,
    letterSpacing: "0.4em",
    color: C_TEXT,
  },
  totalVal: {
    border: `1px solid ${C_BORDER}`,
    background: C_LABEL_BG,
    padding: "10px 12px",
    textAlign: "right",
    fontFamily: "monospace",
    color: C_HIGHLIGHT_FG,
    fontWeight: 800,
  },

  // ── 확인 문구
  confirmLine: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: 800,
    color: C_TEXT,
    margin: "26px 0",
    letterSpacing: "0.05em",
  },

  // ── 발행처
  issuerHeader: {
    fontSize: 13,
    fontWeight: 800,
    color: C_TEXT,
    marginBottom: 4,
    paddingLeft: 2,
  },
  issuerTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  issuerLabel: {
    width: 100,
    background: C_LABEL_BG,
    border: `1px solid ${C_BORDER}`,
    padding: "7px 12px",
    textAlign: "center",
    fontWeight: 700,
    letterSpacing: "0.3em",
    color: C_TEXT,
  },
  issuerVal: {
    border: `1px solid ${C_BORDER}`,
    padding: "7px 12px",
    color: C_TEXT,
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

// 시안 영수금액 "₩ 2 0 0 , 0 0 0 원" 형태 — 숫자 사이 자간 강조용 문자열 생성.
function spaced(numStr) {
  return numStr.split("").join(" ");
}

// 한글 금액: "200,000" → "이십만 원 정"
//   단순 만 단위 처리 (영수증 범위 — 억 단위 미만 가정).
const DIGITS_KOR = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const UNITS_SMALL = ["", "십", "백", "천"];
const UNITS_BIG   = ["", "만", "억", "조"];
function numberToKorean(n) {
  let num = Math.floor(Number(n) || 0);
  if (num === 0) return "영";
  const groups = [];
  while (num > 0) {
    groups.push(num % 10000);
    num = Math.floor(num / 10000);
  }
  const parts = [];
  for (let g = groups.length - 1; g >= 0; g--) {
    const v = groups[g];
    if (v === 0) continue;
    let str = "";
    const s4 = String(v).padStart(4, "0");
    for (let i = 0; i < 4; i++) {
      const d = Number(s4[i]);
      if (d === 0) continue;
      const unit = UNITS_SMALL[3 - i];
      // "일십" / "일백" / "일천" 은 보통 생략. "일만/일억" 도 흔히 생략 가능하나 금액에는 표기 OK.
      if (d === 1 && unit) str += unit;
      else str += DIGITS_KOR[d] + unit;
    }
    parts.push(str + UNITS_BIG[g]);
  }
  return parts.join("");
}

export default function ReceiptTemplate({
  issuer = {},      // engineer_business_info row
  recipient = {},   // { type, name, bizName, bizNo, address, phone }
  items = [],       // [{ label, qty, price, subItems?, note? }]
  vat = {},         // { supply, vat, total }
  vatMode = "inclusive",
  hideVat = true,   // 영수증 부가세 표기 생략 옵션
  issuedAt,         // "YYYY년 MM월 DD일"
  serialNo,         // "260618-005"
}) {
  const dateStr = issuedAt || kstTodayKor();
  const isBusiness = recipient.type === "business";
  const recipientLabel = isBusiness ? (recipient.bizName || recipient.address) : (recipient.address || recipient.name);
  const totalAmount = Number(vat.total) || 0;

  // 빈 행 채우기.
  const MIN_ROWS = 6;
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

  return (
    <div style={s.page}>
      <div style={s.title}>영 수 증</div>

      {/* 상단 정보 */}
      <table style={s.topTable}>
        <tbody>
          <tr>
            <td style={s.topLabel}>발행번호</td>
            <td style={s.topVal}>{serialNo || ""}</td>
            <td style={s.topLabel}>영수일자</td>
            <td style={s.topVal}>{dateStr}</td>
          </tr>
          <tr>
            <td style={s.topLabel}>받는 분</td>
            <td style={s.topVal} colSpan={2}>{recipientLabel || ""}</td>
            <td style={s.topValEnd}>귀하</td>
          </tr>
          <tr>
            <td style={s.topLabel}>연락처</td>
            <td style={s.topVal} colSpan={3}>{recipient.phone || ""}</td>
          </tr>
        </tbody>
      </table>

      {/* 영수금액 강조 */}
      <table style={s.amountTable}>
        <tbody>
          <tr>
            <td rowSpan={2} style={s.amountLabel}>
              영 수<br/>금 액
            </td>
            <td style={s.amountValRowTop}>
              일금 {numberToKorean(totalAmount)} 원 정
            </td>
          </tr>
          <tr>
            <td style={s.amountValRowBottom}>
              (₩ {spaced(fmt(totalAmount))} 원)
            </td>
          </tr>
        </tbody>
      </table>

      {/* 품목표 */}
      <table style={s.table}>
        <colgroup>
          <col style={{ width: 70 }}/>
          <col/>
          <col style={{ width: 160 }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={s.th}>NO</th>
            <th style={s.th}>내 역</th>
            <th style={s.th}>금 액</th>
          </tr>
        </thead>
        <tbody>
          {flatRows.map((r, i) => {
            if (r.kind === "empty") {
              return (
                <tr key={`e-${i}`}>
                  <td style={s.tdCenter}>&nbsp;</td>
                  <td style={s.td}>&nbsp;</td>
                  <td style={s.tdNum}>&nbsp;</td>
                </tr>
              );
            }
            if (r.kind === "sub") {
              return (
                <tr key={`s-${i}`}>
                  <td style={s.tdCenter}>&nbsp;</td>
                  <td style={s.tdSub}>└ {r.text}</td>
                  <td style={s.tdNum}>&nbsp;</td>
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
                <td style={s.tdNum}>{sub ? `${fmt(sub)}원` : ""}</td>
              </tr>
            );
          })}
          <tr>
            <td style={s.totalLabel} colSpan={2}>합 계</td>
            <td style={s.totalVal}>{fmt(totalAmount)}원</td>
          </tr>
        </tbody>
      </table>

      {/* 확인 문구 */}
      <div style={s.confirmLine}>
        위 금액을 정히 영수하였습니다.
      </div>

      {/* 발행처 */}
      <div style={s.issuerHeader}>■ 발 행 처</div>
      <table style={s.issuerTable}>
        <tbody>
          <tr>
            <td style={s.issuerLabel}>상 &nbsp; 호</td>
            <td style={s.issuerVal}>{issuer.business_name || ""}</td>
          </tr>
          <tr>
            <td style={s.issuerLabel}>대 표 자</td>
            <td style={s.issuerVal}>{issuer.representative_name || ""}</td>
          </tr>
          <tr>
            <td style={s.issuerLabel}>사업자번호</td>
            <td style={s.issuerVal}>{issuer.business_no || ""}</td>
          </tr>
          <tr>
            <td style={s.issuerLabel}>주 &nbsp; 소</td>
            <td style={s.issuerVal}>{issuer.business_address || ""}</td>
          </tr>
          <tr>
            <td style={s.issuerLabel}>연 락 처</td>
            <td style={s.issuerVal}>
              {issuer.bank_name || ""} {issuer.bank_account || ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
