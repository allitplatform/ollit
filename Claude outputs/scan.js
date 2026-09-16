// 기존 블로그의 카테고리와 글 목록을 읽어옵니다.
//   node src/scan.js
// 결과: data/blog_scan.json  (+ 터미널 요약)
const fs = require('fs');
const path = require('path');
const { openSession } = require('./browser');
const cfg = require('./config');

const dec = (s) => {
  try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); }
  catch { return String(s); }
};

async function json(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const body = await page.evaluate(() => document.body ? document.body.innerText : '');
  const s = body.indexOf('{');
  const e = body.lastIndexOf('}');
  if (s < 0) return null;
  const raw = body.slice(s, e + 1);
  try { return JSON.parse(raw); }
  catch {
    // 네이버가 따옴표 없는 키를 내려주는 경우
    try { return eval('(' + raw + ')'); } catch { return null; }
  }
}

(async () => {
  const { browser, page } = await openSession();
  const id = cfg.BLOG_ID;
  const out = { blogId: id, scannedAt: new Date().toISOString(), categories: [], posts: [] };

  // 1) 카테고리
  const cats = await json(page, `https://blog.naver.com/CategoryList.naver?blogId=${id}&viewdate=&currentPage=1`);
  const walk = (arr, depth = 0) => {
    (arr || []).forEach((c) => {
      out.categories.push({
        no: c.categoryNo,
        name: dec(c.categoryName),
        count: c.parentCategoryNo != null ? c.postCnt : c.postCnt,
        depth,
      });
      if (c.categories) walk(c.categories, depth + 1);
      if (c.childCategoryList) walk(c.childCategoryList, depth + 1);
    });
  };
  if (cats) walk(cats.categoryList || cats.categories || []);

  // 2) 글 목록 (최대 10페이지 × 30건)
  for (let p = 1; p <= 10; p++) {
    const d = await json(page,
      `https://blog.naver.com/PostTitleListAsync.naver?blogId=${id}` +
      `&currentPage=${p}&countPerPage=30&categoryNo=0&parentCategoryNo=&viewdate=&range=&cpage=`);
    const list = d && (d.postList || d.resultList);
    if (!list || !list.length) break;
    list.forEach((x) => out.posts.push({
      no: x.logNo,
      title: dec(x.title),
      date: x.addDate,
      categoryNo: x.categoryNo,
    }));
    if (list.length < 30) break;
    await page.waitForTimeout(600);
  }

  const dest = path.join(cfg.ROOT, 'data', 'blog_scan.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');

  console.log('\n── 카테고리 ──');
  out.categories.forEach((c) => console.log(`  ${'  '.repeat(c.depth)}[${c.no}] ${c.name} (${c.count ?? '-'})`));
  console.log(`\n── 글 ${out.posts.length}건 ──`);
  out.posts.forEach((x) => console.log(`  ${x.date}  ${x.title}`));
  console.log(`\n저장: ${dest}\n`);

  await browser.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
