// 2026-10-06 — 휴대폰 상태표시줄(시계·배터리) 자리를 불투명 단색으로 덮는 띠.
//   앱은 상태표시줄 아래까지 화면을 그리는 설정(black-translucent)이라, 화면을 스크롤하면
//   내용이 시계 줄 밑으로 비쳐 흐릿하게 보인다. 이 띠를 맨 위에 고정해 항상 같은 색으로 보이게 한다.
//   · 높이 = 상단 safe-area. 앱의 글자 크기 설정(body zoom)만큼 커지지 않도록 배율로 나눈다.
//   · 누르는 것을 막지 않는다(pointer-events 없음). 시트·모달(z-index 1000)보다는 아래.
export default function SafeTopCover({ background = "var(--bg-secondary)" }) {
  return (
    <div aria-hidden="true" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 300, pointerEvents: "none",
      height: "calc(env(safe-area-inset-top, 0px) / var(--font-scale, 1))",
      background,
    }}/>
  );
}
