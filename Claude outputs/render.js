/**
 * 원고 JSON → 스마트에디터에 붙여넣을 HTML 변환
 *
 *   npm run render -- post-01
 *
 * 블록 타입
 *   h2        소제목
 *   p         본문 (인라인 서식 마크업 사용 가능)
 *   quote     인용구
 *   table     표  { head: [], rows: [[]] }
 *   image     이미지 자리표시 { file, caption }  ← publish 단계에서 실제 업로드로 치환
 *   video     유튜브 임베드 { url }
 *   divider   구분선
 *   callout   강조 박스
 *
 * 인라인 서식 (본문 문자열 안에서)
 *   **볼드**            → <b>
 *   __밑줄__            → <u>
 *   ==형광==            → 노란 글자 배경색
 *   ^^크게^^            → 글자 크기 확대
 *   ~~작게~~            → 글자 크기 축소
 */
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/==(.+?)==/g, '<span style="background-color:#FFF3A3">$1</span>')
    .replace(/\^\^(.+?)\^\^/g, '<span style="font-size:24px">$1</span>')
    .replace(/~~(.+?)~~/g, '<span style="font-size:15px;color:#888888">$1</span>');
}

/**
 * 모바일 줄바꿈 — 어절 단위로 약 20자마다 끊습니다.
 *
 * 모바일 본문은 한 줄에 17~18자가 들어갑니다. 문장 단위로만 끊으면
 * 한 문장이 그대로 세 줄이 되어 읽기 답답합니다.
 * 서식 표시(**, __, ==, ^^, ~~) 안쪽에서는 끊지 않습니다.
 */
const BR = '@@BR@@';

function smartWrap(text, target = 20) {
  const marks = ['**', '__', '==', '^^', '~~'];
  const open = {};
  marks.forEach((m) => { open[m] = false; });
  const inMark = () => marks.some((m) => open[m]);

  let out = '';
  let len = 0;

  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (marks.includes(two)) {
      open[two] = !open[two];
      out += two;
      i += 1;
      continue;
    }

    const ch = text[i];
    out += ch;
    len += 1;

    if (ch !== ' ') continue;

    const prev = out.trimEnd().slice(-1);
    const sentenceEnd = ['.', '!', '?'].includes(prev);

    if (sentenceEnd || len >= target) {
      out = out.trimEnd() + BR;
      len = 0;
    }
  }
  // 꼬리 정리 — 너무 짧은 줄은 앞줄에 붙입니다.
  const lines = out.split(BR).filter((x) => x.length);
  const merged = [];
  for (const line of lines) {
    const last = merged[merged.length - 1];
    if (last && line.length < 8 && last.length + line.length <= target + 6) {
      merged[merged.length - 1] = last + ' ' + line;
    } else {
      merged.push(line);
    }
  }
  return merged.join(BR);
}

/** 줄바꿈 표시를 <br> 로 바꿉니다 (inline 변환 뒤에 호출) */
function applyBreaks(html) {
  return html.split(BR).join('<br>');
}

function block(b) {
  // 모바일 가독성 기준: 본문 19px, 줄간격 2.0
  const P = 'font-size:19px;line-height:2.0;';
  const al = `text-align:${b.align || 'left'};`;

  switch (b.type) {
    case 'h2':
      // 소제목은 가운데 정렬 — 스크롤 중에 구간이 눈에 띕니다
      return `<h2 style="font-size:24px;line-height:1.7;font-weight:bold;text-align:${b.align || 'center'};">${inline(b.text)}</h2>`;

    case 'h3':
      return `<h3 style="font-size:19px;line-height:1.8;font-weight:bold;${al}">${inline(b.text)}</h3>`;

    case 'p':
      return `<p style="${P}${al}">${applyBreaks(inline(smartWrap(b.text)))}</p>`;

    case 'quote':
      return `<blockquote style="font-size:19px;line-height:2.0;text-align:left;border-left:3px solid #1E4634;padding-left:16px;color:#333333;">${applyBreaks(inline(smartWrap(b.text)))}</blockquote>`;

    case 'callout':
      return `<p style="font-size:19px;line-height:1.9;background-color:#E7EFE9;padding:16px;text-align:${b.align || 'center'};"><b>${applyBreaks(inline(smartWrap(b.text, 22)))}</b></p>`;

    case 'divider':
      return '<hr />';

    case 'table': {
      const cell = 'font-size:17px;line-height:1.7;padding:12px 10px;border:1px solid #DDDDDD;text-align:center;';
      const head = b.head
        ? `<tr>${b.head.map((h) => `<th style="${cell}background-color:#E7EFE9;"><b>${inline(h)}</b></th>`).join('')}</tr>`
        : '';
      const rows = b.rows
        .map((r) => `<tr>${r.map((c) => `<td style="${cell}">${inline(c)}</td>`).join('')}</tr>`)
        .join('');
      return `<table style="border-collapse:collapse;width:100%;">${head}${rows}</table>`;
    }

    case 'image':
    case 'video':
      return '';

    default:
      throw new Error(`알 수 없는 블록 타입: ${b.type}`);
  }
}

// 문단 사이 빈 줄 — 모바일에서 숨 쉴 공간
const SPACER = '<p style="font-size:19px;line-height:2.0;text-align:left;"><br></p>';

function joinBlocks(list) {
  return list.filter(Boolean).join('\n' + SPACER + '\n');
}

/**
 * 본문을 순서대로 처리할 수 있게 세그먼트로 나눕니다.
 *   { kind: 'html',  html }
 *   { kind: 'image', file, caption }
 *   { kind: 'video', url }
 * 이미지·영상은 그 자리에서 삽입하고, 사이의 텍스트는 묶어서 붙여넣습니다.
 */
function segments(post) {
  const out = [];
  let buf = [];
  const flush = () => {
    if (buf.length) { out.push({ kind: 'html', html: joinBlocks(buf) }); buf = []; }
  };
  for (const b of post.blocks) {
    if (b.type === 'image') { flush(); out.push({ kind: 'image', file: b.file, caption: b.caption }); }
    else if (b.type === 'video') { flush(); out.push({ kind: 'video', url: b.url }); }
    else buf.push(block(b));
  }
  flush();
  return out;
}

function captionHtml(text) {
  return `<p style="font-size:15px;line-height:1.7;color:#888888;text-align:center;">${inline(text)}</p>`;
}

function render(post) {
  const html = joinBlocks(post.blocks.map(block));
  const plainLen = post.blocks
    .filter((b) => ['p', 'h2', 'h3', 'quote', 'callout'].includes(b.type))
    .map((b) => (b.text || '').replace(/[*_=^~]/g, ''))
    .join('').length;
  return { html, plainLen };
}

if (require.main === module) {
  const slug = process.argv[2] || process.argv[process.argv.length - 1];
  const src = path.join(cfg.POSTS_DIR, `${slug}.json`);
  const post = JSON.parse(fs.readFileSync(src, 'utf8'));
  const { html, plainLen } = render(post);

  fs.mkdirSync(cfg.OUT_DIR, { recursive: true });
  const out = path.join(cfg.OUT_DIR, `${slug}.html`);
  fs.writeFileSync(out, html, 'utf8');

  console.log(`제목: ${post.title}`);
  console.log(`본문 글자수(서식 제외): 약 ${plainLen}자`);
  if (plainLen < 2000) console.log('  ⚠ 2,000자 미만입니다. 내용을 더 채우세요.');
  if (plainLen > 2500) console.log('  ⚠ 2,500자를 넘습니다. 줄이세요.');
  console.log(`이미지 슬롯: ${post.blocks.filter((b) => b.type === 'image').length}개`);
  console.log(`영상 슬롯: ${post.blocks.filter((b) => b.type === 'video').length}개`);
  console.log(`저장: ${out}`);
}

module.exports = { render, segments, captionHtml, inline };
