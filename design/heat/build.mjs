// 냉난방기 수리(heat) 통이미지 빌드: sections/s1a · s1b · s3~s7.html → Playwright 캡처 → JPG (가로 1000px)
//   node build.mjs    → assets/heat/ 의 AI 사진(01~12.png) + public/img/heat/ 실제 작업 사진(gauge · temp · outdoor) 사용
//                        public/img/heat/s*.jpg · 증상 칸 사진 public/img/heat/sym/*.jpg · preview_all.jpg(390px 폭 페이지 전체) 생성
//   node build.mjs 4  → 지정한 칸만 다시 렌더 (preview_all 은 다시 찍음)
//   s2 증상 6칸 · s1 제목 · 접수 폼은 heat.html 안의 HTML (이미지 아님)
//   크롬 경로는 CHROME_PATH 환경변수로 지정
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_DIR = path.resolve(ROOT, "../../assets/heat");
const PUBLIC = path.resolve(ROOT, "../../public");
const OUT_DIR = path.join(PUBLIC, "img/heat");
const SYM_DIR = path.join(OUT_DIR, "sym");
const PREVIEW = path.join(ROOT, "preview_all.jpg");
const PREVIEW_W = 390;   // 휴대폰 폭으로 확인
const ALL = ["1a", "1b", 3, 4, 5, 6, 7];
const SYM = ["02_palm", "03_remote", "04_light", "05_leak", "06_frost", "07_drip"];
const PHOTOS = ["01_hero", "05_leak", "08_empty", "09_leaktest", "10_stores", "11_warm", "12_tech", ...SYM].map((n) => n + ".png");
const MAX_BYTES = 300 * 1024;   // 웹용 300KB 이하
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file;
    if (p.startsWith("/photos/")) file = path.join(PHOTO_DIR, p.slice(8));
    else if (p.startsWith("/real/")) file = path.join(OUT_DIR, p.slice(6));
    else if (p.startsWith("/site/")) file = path.join(PUBLIC, p.slice(6));
    else file = path.join(ROOT, p);
    const okRoot = [ROOT, PHOTO_DIR, PUBLIC].some((r) => file.startsWith(r));
    if (!okRoot || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function toJpeg(png, width = 1000) {
  const resized = await sharp(png).resize({ width }).toBuffer();
  for (let q = 80; q >= 50; q -= 5) {
    const buf = await sharp(resized).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (buf.length <= MAX_BYTES) return { buf, q };
  }
  throw new Error("품질 50에서도 300KB 초과");
}

async function main() {
  for (const name of PHOTOS) {
    if (!fs.existsSync(path.join(PHOTO_DIR, name))) throw new Error(`사진 없음: ${PHOTO_DIR}/${name}`);
  }
  fs.mkdirSync(SYM_DIR, { recursive: true });

  // s2 증상 칸 사진 (HTML 그리드용 정사각 600px)
  for (const n of SYM) {
    const buf = await sharp(path.join(PHOTO_DIR, n + ".png")).resize(600, 600, { fit: "cover" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(SYM_DIR, n + ".jpg"), buf);
    console.log(`sym/${n}.jpg  ${(buf.length / 1024).toFixed(0)}KB`);
  }

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 1.5 });
  const sizes = {};
  const only = process.argv.slice(2);
  for (const i of only.length ? only : ALL) {
    await page.goto(`${base}/sections/s${i}.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const family = await page.evaluate(async () => { await document.fonts.load('800 40px "Pretendard"'); return document.fonts.check('800 40px "Pretendard"'); });
    if (!family) throw new Error(`s${i}: Pretendard 로드 실패`);
    const png = await page.locator("section").screenshot();
    const { buf, q } = await toJpeg(png);
    fs.writeFileSync(path.join(OUT_DIR, `s${i}.jpg`), buf);
    const meta = await sharp(buf).metadata();
    console.log(`s${i}.jpg  ${meta.width}x${meta.height}  q${q}  ${(buf.length / 1024).toFixed(0)}KB`);
    sizes[`s${i}`] = [meta.width, meta.height];
  }

  // heat.html 이미지 칸에 실제 크기 기록 (자리가 미리 잡혀 앵커 위치가 틀어지지 않게)
  const htmlPath = path.join(PUBLIC, "heat.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  for (const [name, [w, h]] of Object.entries(sizes)) {
    const re = new RegExp(`(src="img/heat/${name}\\.jpg"[^>]*?) width="\\d+" height="\\d+"`);
    if (!re.test(html)) throw new Error(`heat.html 에 ${name}.jpg 칸이 없음`);
    html = html.replace(re, `$1 width="${w}" height="${h}"`);
  }
  fs.writeFileSync(htmlPath, html);
  console.log("heat.html: width / height 갱신");

  // preview_all: 휴대폰 폭으로 페이지 전체 (HTML 부분 포함)
  const ph = await browser.newPage({ viewport: { width: PREVIEW_W, height: 844 }, deviceScaleFactor: 1 });
  await ph.goto(`${base}/site/heat.html`, { waitUntil: "networkidle" });
  await ph.evaluate(async () => {
    document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    await document.fonts.ready;
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}.fixed{display:none!important}.top{position:static!important}";
    document.head.appendChild(st);
  });
  await ph.waitForTimeout(400);
  const full = await ph.screenshot({ fullPage: true, type: "png" });
  await sharp(full).jpeg({ quality: 80, mozjpeg: true }).toFile(PREVIEW);
  const pm = await sharp(PREVIEW).metadata();
  console.log(`preview: ${PREVIEW} (${pm.width}x${pm.height})`);

  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
