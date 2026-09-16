# -*- coding: utf-8 -*-
# api/sms/send.js — eng_assign / eng_unassign 템플릿·검증 추가 (Mig 193 쌍)
import io, sys

P = "/sessions/rcw-01u4et6pwfchupgdzvaelxyk/mnt/ollit/api/sms/send.js"
s = io.open(P, encoding="utf-8").read()
orig = len(s)

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        print("FAIL %s count=%d" % (label, n)); sys.exit(1)
    s = s.replace(old, new)
    print("ok", label)

# [1] 템플릿 — visit_fee 앞에 기사용 2종 추가
rep(
'''  if (type === "visit_fee") {''',
'''  // 2026-07-26 Mig 193 — 기사용 문자 (수신자 = 기사 폰. customerPhone 필드를
  //   수신자 슬롯으로 재사용 — 트리거가 기사 번호를 넣어 보냄).
  //   푸시 지연 대비 확실 채널 (사장님 결정: 배정마다 무조건 문자).
  if (type === "eng_assign") {
    const sched = vars.scheduled ? `일정: ${vars.scheduled}` : "일정: 앱에서 확정 필요";
    const head  = vars.reassigned ? "재배정 안내" : "새 작업 배정";
    return (
`[올잇] ${head}
${vars.customer || "고객"} 고객 · ${vars.region || "지역 미정"}
${sched}
${vars.taskNo ? "작업번호: " + vars.taskNo + "\\n" : ""}올잇 앱에서 상세 확인해 주세요.`
    );
  }
  if (type === "eng_unassign") {
    return (
`[올잇] 배정 변경 안내
${vars.customer || "고객"} 고객 (${vars.region || "지역 미정"}) 건이
기사님 일정에서 제외되었습니다.
해당 건은 방문하지 않으셔도 됩니다.
앱에서 오늘 일정을 확인해 주세요.`
    );
  }
  if (type === "visit_fee") {''',
"templates")

# [2] type 화이트리스트
rep(
'''  if (type !== "assign" && type !== "complete" && type !== "visit_fee") {
    res.status(400).json({ ok: false, error: "type must be assign|complete|visit_fee" });
    return;
  }''',
'''  const ENG_TYPES = ["eng_assign", "eng_unassign"];   // 2026-07-26 Mig 193
  if (type !== "assign" && type !== "complete" && type !== "visit_fee" && !ENG_TYPES.includes(type)) {
    res.status(400).json({ ok: false, error: "type must be assign|complete|visit_fee|eng_assign|eng_unassign" });
    return;
  }''',
"type whitelist")

# [3] vars 검증 분기 — 기사용은 amount/engineerName 요구 X
rep(
'''  } else {
    if (vars.amount == null || Number.isNaN(Number(vars.amount))) {
      res.status(400).json({ ok: false, error: "amount 누락 / 형식 오류" });
      return;
    }
  }''',
'''  } else if (!ENG_TYPES.includes(type)) {
    if (vars.amount == null || Number.isNaN(Number(vars.amount))) {
      res.status(400).json({ ok: false, error: "amount 누락 / 형식 오류" });
      return;
    }
  }
  // eng_* — customer/region 은 비어도 발송 (기사에게 안 가는 것보다 낫다)''',
"vars validation")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("WROTE (%d -> %d)" % (orig, len(s)))
