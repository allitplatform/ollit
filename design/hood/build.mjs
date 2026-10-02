// 주방후드 통이미지 빌드: sections/s1~s10.html → Playwright 캡처 → JPG
//   node build.mjs                → photos/ 사용, public/img/hood/s1~s10.jpg + preview_all.jpg 생성
//   node build.mjs --placeholder  → 없는 사진만 단색 임시 사진으로 채워 레이아웃 확인 (out_placeholder/ 에 저장)
//   크롬 경로는 CHROME_PATH 환경변수로 지정
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = process.argv.includes("--placeholder");
const REAL_DIR = path.join(ROOT, "photos");
const PHOTO_DIR = PLACEHOLDER ? path.join(ROOT, "photos_placeholder") : REAL_DIR;
const OUT_DIR = PLACEHOLDER ? path.join(ROOT, "out_placeholder") : path.resolve(ROOT, "../../public/img/hood");
const PREVIEW = path.join(PLACEHOLDER ? OUT_DIR : ROOT, "preview_all.jpg");
const PHOTOS = [
  ["b1_hero", 1600, 2000], ["b2_cover", 1600, 1062], ["b3_soak", 1600, 1062], ["b4_scrape", 1600, 1062], ["b5_floor", 1600, 1062],
  ["ba1_before", 1600, 1600], ["ba1_after", 1600, 1600], ["ba2_before", 1600, 1600], ["ba2_after", 1600, 1600],
  ["ba3_before", 1600, 1062], ["ba3_after", 1600, 1062],
  ["h1_hero", 1600, 2000], ["h6_after", 1600, 1062], ["h8_install", 1600, 1062],
];
const MAX_BYTES = 400 * 1024;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

// 있는 사진은 그대로 복사, 없는 사진만 단색 면으로 채움
async function makePlaceholders() {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  for (const [name, w, h] of PHOTOS) {
    const real = path.join(REAL_DIR, `${name}.jpg`);
    const dest = path.join(PHOTO_DIR, `${name}.jpg`);
    if (fs.existsSync(real)) { fs.copyFileSync(real, dest); continue; }
    await sharp({ create: { width: w, height: h, channels: 3, background: "#D5D5D2" } }).jpeg({ quality: 90 }).toFile(dest);
    console.log(`임시 사진: ${name}.jpg`);
  }
}

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = p.startsWith("/photos/") ? path.join(PHOTO_DIR, p.slice(8)) : path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function toJpeg(png) {
  const resized = await sharp(png).resize({ width: 1000 }).toBuffer();
  for (let q = 80; q >= 50; q -= 5) {
    const buf = await sharp(resized).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (buf.length <= MAX_BYTES) return { buf, q };
  }
  throw new Error("품질 50에서도 400KB 초과");
}

async function main() {
  if (PLACEHOLDER) await makePlaceholders();
  for (const [name] of PHOTOS) {
    if (!fs.existsSync(path.join(PHOTO_DIR, `${name}.jpg`))) throw new Error(`사진 없음: ${PHOTO_DIR}/${name}.jpg`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 1.5 });
  const outs = [];
  for (let i = 1; i <= 10; i++) {
    await page.goto(`${base}/sections/s${i}.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const family = await page.evaluate(() => document.fonts.check('800 40px "Pretendard"'));
    if (!family) throw new Error(`s${i}: Pretendard 로드 실패`);
    const png = await page.locator("section").screenshot();
    const { buf, q } = await toJpeg(png);
    const out = path.join(OUT_DIR, `s${i}.jpg`);
    fs.writeFileSync(out, buf);
    const meta = await sharp(buf).metadata();
    console.log(`s${i}.jpg  ${meta.width}x${meta.height}  q${q}  ${(buf.length / 1024).toFixed(0)}KB`);
    outs.push(out);
  }
  await browser.close();
  server.close();

  const parts = await Promise.all(outs.map((f) => sharp(f).resize({ width: 500 }).toBuffer({ resolveWithObject: true })));
  const total = parts.reduce((s, p) => s + p.info.height, 0);
  let top = 0;
  const composite = parts.map((p) => { const c = { input: p.data, top, left: 0 }; top += p.info.height; return c; });
  await sharp({ create: { width: 500, height: total, channels: 3, background: "#ffffff" } })
    .composite(composite).jpeg({ quality: 80 }).toFile(PREVIEW);
  console.log(`preview: ${PREVIEW} (500x${total})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
