// 기사 양성 과정(academy) 통이미지 빌드: sections/s1~s14.html → Playwright 캡처 → JPG
//   node build.mjs  → assets/academy/ 사진(실제 r*·f*.jpg, AI a*.png) 사용, public/img/academy/s1~s14.jpg + preview_all.jpg(390px 폭) 생성
//   크롬 경로는 CHROME_PATH 환경변수로 지정
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = false;
const PHOTO_DIR = path.resolve(ROOT, "../../assets/academy");
const OUT_DIR = path.resolve(ROOT, "../../public/img/academy");
const PREVIEW = path.join(ROOT, "preview_all.jpg");
const PREVIEW_W = 390;   // 휴대폰 폭으로 확인
// v3: 실제 교육 · 현장 사진은 밝게 보정한 v3_*.jpg, 밝은 AI 사진은 h*_bright.png
const PHOTOS = [
  "h1_bright.png", "h2_bright.png", "h6_bright.png", "h13_bright.png",
  "v3_f_before.jpg", "v3_f_wash.jpg", "v3_f_after.jpg",
  "v3_r18.jpg", "v3_r23.jpg", "v3_r13.jpg", "v3_r16.jpg", "v3_r20.jpg", "v3_r22.jpg", "v3_r24.jpg", "v3_r15.jpg",
  "v3_r27.jpg", "v3_r26.jpg", "v3_r21.jpg",
];
const MAX_BYTES = 400 * 1024;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = p.startsWith("/photos/") ? path.join(PHOTO_DIR, p.slice(8)) : path.join(ROOT, p);
    if ((!file.startsWith(ROOT) && !file.startsWith(PHOTO_DIR)) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
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
  for (const name of PHOTOS) {
    if (!fs.existsSync(path.join(PHOTO_DIR, name))) throw new Error(`사진 없음: ${PHOTO_DIR}/${name}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 1.5 });
  const outs = [];
  const sizes = {};
  for (let i = 1; i <= 14; i++) {
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
    sizes[`s${i}`] = [meta.width, meta.height];
  }
  await browser.close();
  server.close();

  const parts = await Promise.all(outs.map((f) => sharp(f).resize({ width: PREVIEW_W }).toBuffer({ resolveWithObject: true })));
  const total = parts.reduce((s, p) => s + p.info.height, 0);
  let top = 0;
  const composite = parts.map((p) => { const c = { input: p.data, top, left: 0 }; top += p.info.height; return c; });
  await sharp({ create: { width: PREVIEW_W, height: total, channels: 3, background: "#ffffff" } })
    .composite(composite).jpeg({ quality: 80 }).toFile(PREVIEW);
  console.log(`preview: ${PREVIEW} (${PREVIEW_W}x${total})`);

  // academy.html 이미지 칸에 실제 크기 기록 (지연 로딩이어도 자리가 미리 잡혀 앵커 위치가 틀어지지 않게)
  if (!PLACEHOLDER) {
    const htmlPath = path.resolve(ROOT, "../../public/academy.html");
    let html = fs.readFileSync(htmlPath, "utf8");
    for (const [name, [w, h]] of Object.entries(sizes)) {
      const re = new RegExp(`(data-img="img/academy/${name}\\.jpg")(?: data-w="\\d+" data-h="\\d+")?`);
      if (!re.test(html)) throw new Error(`academy.html 에 ${name}.jpg 칸이 없음`);
      html = html.replace(re, `$1 data-w="${w}" data-h="${h}"`);
    }
    fs.writeFileSync(htmlPath, html);
    console.log("academy.html: data-w / data-h 갱신");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
