// PWA 아이콘 생성 (다크 배경 #1A1512 + 핫핑크 ∞)
// 192 / 512 = maskable, 안전 영역 80% / 180 = iOS apple-touch-icon
// 사용: node scripts/generate-pwa-icons.js

import sharp from "sharp";

// 마스터 SVG — 1024x1024, 안전 영역 80% 박힘 (가운데 80%에 ∞)
// maskable이라 캔버스 전체를 다크로 채움 (OS가 마스크 박힐 차례)
const masterSvg = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#1A1512"/>
  <g transform="translate(102 102) scale(8.2)">
    <circle cx="27" cy="50" r="23" fill="none" stroke="#FF1B8D" stroke-width="6"/>
    <circle cx="73" cy="50" r="23" fill="none" stroke="#FF1B8D" stroke-width="6"/>
    <circle cx="50" cy="50" r="10" fill="#FF1B8D"/>
  </g>
</svg>`;

const sizes = [
  { size: 192, file: "public/icon-192.png" },
  { size: 512, file: "public/icon-512.png" },
  { size: 180, file: "public/icon-180.png" },
];

for (const { size, file } of sizes) {
  await sharp(Buffer.from(masterSvg))
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`박힘 ✓ ${file} (${size}x${size})`);
}
