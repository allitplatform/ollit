// V14 v8 — 유솔N 세척 작업만 그린 N 마크 (사장님 spec)
// 조건: client === '유솔홈케어 N' && workType === '세척' (냉매충전 X)
// 색: 네이버 그린 #03C75A / 흰 글자
//
// 사용:
//   <UsolNBadge task={task}/>                                      ← 일반 카드
//   <UsolNBadge task={{ client, workType }}/>                       ← 부분 객체
//   <UsolNBadge task={task} size="xs"/>                             ← 작은 마크 (점, 작은 카드)

export function UsolNBadge({ task, size = "md" }) {
  if (!task) return null;
  const client = task.client || task.principal || "";
  const workType = task.workType || "";
  const isUsolN = client === "유솔홈케어 N" || task.principalId === "usol_n";
  if (!isUsolN) return null;
  if (!workType.includes("세척")) return null;

  const dim = size === "xs"
    ? { w: 14, h: 14, fs: 9,  br: 3 }
    : size === "sm"
      ? { w: 16, h: 16, fs: 10, br: 4 }
      : { w: 18, h: 18, fs: 11, br: 4 };

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: dim.w, height: dim.h,
      borderRadius: dim.br,
      background: "#03C75A",
      color: "#fff",
      fontSize: dim.fs,
      fontWeight: 800,
      flexShrink: 0,
      letterSpacing: 0,
      lineHeight: 1,
    }}>
      N
    </span>
  );
}

export default UsolNBadge;
