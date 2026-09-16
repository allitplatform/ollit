// 24개 기사 캘린더 + 올잇_배정대기 측 catch 측 catch → data/gcal-index.json
// 사용: node scripts/gcal-extract.cjs
// 측 catch: scripts/gcal-auth.cjs 측 catch gcal_token.json 발급 측 catch.
const fs = require("fs"), path = require("path");
const { google } = require("googleapis");

const ROOT = path.join(__dirname, "..");
const CRED_PATH  = path.join(ROOT, "gcal_credentials.json");
const TOKEN_PATH = path.join(ROOT, "gcal_token.json");
const OUT_PATH   = path.join(ROOT, "data", "gcal-index.json");

// 측 catch 측 catch
const TIME_MIN = "2026-04-01T00:00:00+09:00";
const TIME_MAX = "2026-07-01T00:00:00+09:00";
const CAL_PREFIX_ENG  = "올데이케어 | ";   // 기사 캘린더
const CAL_NAME_BACKLOG = "올잇_배정대기";   // 측 catch 측 catch

// 작업코드 정규식 — usol YS- / 직영 A-
const TASK_CODE_RE = /\b(YS-(?:N-)?\d{6}-\d{3}|A\d{2,}-[A-Z0-9-]+)\b/g;

// 측 catch 측 catch (description에서 'key: value' 측 catch 측 catch)
const KEY_HINTS = ["고객", "고객명", "수취인", "전화", "연락처", "주소", "서비스", "수량", "메모", "원청", "원청주문", "주문번호"];

function loadCreds() {
  if (!fs.existsSync(CRED_PATH)) { console.error("gcal_credentials.json 측 catch X"); process.exit(1); }
  const raw = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
  return raw.installed || raw.web;
}
function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) { console.error("gcal_token.json 측 catch X — 측 catch scripts/gcal-auth.cjs 실행"); process.exit(1); }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
}

function makeClient() {
  const c = loadCreds();
  const tokens = loadToken();
  const redirectUri = (c.redirect_uris && c.redirect_uris[0]) || "urn:ietf:wg:oauth:2.0:oob";
  const oAuth2Client = new google.auth.OAuth2(c.client_id, c.client_secret, redirectUri);
  oAuth2Client.setCredentials(tokens);
  // 토큰 측 catch 측 catch 시 측 catch
  oAuth2Client.on("tokens", (t) => {
    const merged = { ...tokens, ...t };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
  return google.calendar({ version: "v3", auth: oAuth2Client });
}

// 측 catch 측 catch 측 catch
function extractCodes(s) {
  if (!s) return [];
  const out = new Set();
  const m = s.match(TASK_CODE_RE);
  if (m) m.forEach(c => out.add(c));
  return [...out];
}

// summary 측 catch 측 catch
function inferStatusFromSummary(summary) {
  if (!summary) return null;
  if (summary.includes("[작업완료]")) return "완료";
  if (summary.includes("[일정확정필요]")) return "일정확정필요";
  if (summary.includes("[취소]")) return "취소";
  if (summary.includes("[배정대기]")) return "배정대기";
  return null;
}

// description 측 catch 측 catch 측 catch 측 catch
function parseDescriptionFields(desc) {
  if (!desc) return {};
  const out = {};
  const lines = desc.replace(/<[^>]+>/g, "\n").split(/\r?\n/);
  for (const ln of lines) {
    const m = ln.match(/^\s*([^:：]+)[:：]\s*(.+?)\s*$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim();
    if (!v) continue;
    if (KEY_HINTS.some(h => k.includes(h))) {
      out[k] = v;
    }
  }
  return out;
}

async function listAllCalendars(cal) {
  const cals = [];
  let pageToken;
  do {
    const { data } = await cal.calendarList.list({ pageToken, maxResults: 250 });
    for (const c of (data.items || [])) cals.push(c);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return cals;
}

async function listAllEvents(cal, calendarId) {
  const events = [];
  let pageToken;
  do {
    const { data } = await cal.events.list({
      calendarId,
      timeMin: TIME_MIN,
      timeMax: TIME_MAX,
      singleEvents: true,
      maxResults: 2500,
      orderBy: "startTime",
      pageToken,
    });
    for (const e of (data.items || [])) events.push(e);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return events;
}

(async () => {
  const cal = makeClient();

  console.log("=".repeat(100));
  console.log("Google Calendar 측 catch");
  console.log("=".repeat(100));

  // 측 catch 측 catch 측 catch
  const allCals = await listAllCalendars(cal);
  const targetCals = allCals.filter(c =>
    (c.summary || "").startsWith(CAL_PREFIX_ENG) ||
    (c.summary || "") === CAL_NAME_BACKLOG
  );

  const engCals = targetCals.filter(c => (c.summary || "").startsWith(CAL_PREFIX_ENG));
  const backlogCal = targetCals.find(c => (c.summary || "") === CAL_NAME_BACKLOG);

  console.log(`측 catch ${allCals.length}개 측 catch ${targetCals.length}개 측 catch (기사 ${engCals.length} + 측 catch ${backlogCal ? 1 : 0})`);

  // 측 catch
  if (!fs.existsSync(path.dirname(OUT_PATH))) fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  // 측 catch — 측 catch 측 catch
  const codeIndex = new Map();        // code → [entries]
  const orphanEvents = [];            // 측 catch 측 catch 측 catch 측 catch
  const calStats = [];                // 측 catch 측 catch 측 catch 측 catch

  for (const c of targetCals) {
    const isBacklog = c.summary === CAL_NAME_BACKLOG;
    const engineerName = isBacklog ? null : c.summary.replace(CAL_PREFIX_ENG, "").trim();
    const events = await listAllEvents(cal, c.id);
    console.log(`  · ${c.summary.padEnd(28)} — ${events.length}건`);
    let extractedCount = 0;

    for (const ev of events) {
      const codes = extractCodes(ev.summary + " " + (ev.description || ""));
      const start = ev.start?.dateTime || ev.start?.date || null;
      const end   = ev.end?.dateTime   || ev.end?.date   || null;
      const statusHint = inferStatusFromSummary(ev.summary);
      const descFields = parseDescriptionFields(ev.description || "");

      const entryBase = {
        calendar: c.summary,
        calendarId: c.id,
        eventId: ev.id,
        engineerName,                    // 측 catch 측 catch null
        backlog: isBacklog,
        summary: ev.summary || null,
        scheduledAt: start,
        endAt: end,
        colorId: ev.colorId || null,
        statusHint,                      // [작업완료] 측 catch
        descriptionFields: descFields,
        descriptionRaw: ev.description ? ev.description.slice(0, 2000) : null,
        updated: ev.updated || null,
      };

      if (codes.length === 0) {
        orphanEvents.push(entryBase);
        continue;
      }
      for (const code of codes) {
        if (!codeIndex.has(code)) codeIndex.set(code, []);
        codeIndex.get(code).push({ ...entryBase, taskCode: code });
        extractedCount++;
      }
    }
    calStats.push({ calendar: c.summary, events: events.length, extracted: extractedCount });
  }

  // 측 catch 측 catch — 측 catch 코드가 측 catch 측 catch (= 측 catch)
  const multi = [];
  const indexObj = {};
  for (const [code, entries] of codeIndex) {
    indexObj[code] = entries.length === 1 ? entries[0] : { entries, multiCalendar: true };
    if (entries.length > 1) {
      multi.push({ code, count: entries.length, calendars: entries.map(e => e.calendar) });
    }
  }

  const out = {
    timestamp: new Date().toISOString(),
    range: { from: TIME_MIN, to: TIME_MAX },
    summary: {
      calendars: targetCals.length,
      engineerCalendars: engCals.length,
      backlogCalendars: backlogCal ? 1 : 0,
      uniqueTaskCodes: codeIndex.size,
      multiCalendarCodes: multi.length,
      orphanEvents: orphanEvents.length,
    },
    perCalendar: calStats,
    multiCalendarCodes: multi,
    index: indexObj,
    orphanEvents,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log("\n" + "=".repeat(100));
  console.log("측 catch 측 catch");
  console.log("=".repeat(100));
  console.log(`측 catch 측 catch 코드:        ${codeIndex.size}개`);
  console.log(`측 catch 측 catch (재배정 측 catch): ${multi.length}건`);
  console.log(`측 catch 측 catch (코드 측 catch):   ${orphanEvents.length}건`);
  console.log(`측 catch 측 catch: ${OUT_PATH}`);
})().catch(e => {
  console.error("FATAL:", e.message, e.stack);
  process.exit(1);
});
