// OAuth 1회 인증 — gcal_credentials.json → gcal_token.json 발급.
// 사용: node scripts/gcal-auth.cjs
// 1) 출력된 URL을 브라우저에서 열어 allit.platform@gmail.com 로 로그인·승인
// 2) 리다이렉트 페이지의 'code=...' 값을 콘솔에 붙여넣기
const fs = require("fs"), path = require("path"), readline = require("readline");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const ROOT = path.join(__dirname, "..");
const CRED_PATH = path.join(ROOT, "gcal_credentials.json");
const TOKEN_PATH = path.join(ROOT, "gcal_token.json");

function loadCreds() {
  if (!fs.existsSync(CRED_PATH)) {
    console.error(`gcal_credentials.json이 ${CRED_PATH}에 없음.`);
    console.error("Google Cloud Console → OAuth 클라이언트 ID(데스크톱 앱) → JSON 다운로드 → repo 루트에 저장.");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
  // 데스크톱 앱은 'installed', 측 catch 'web' 키
  const c = raw.installed || raw.web;
  if (!c) {
    console.error("credentials JSON에 'installed' 측 catch 'web' 키 측 catch X.");
    process.exit(1);
  }
  return c;
}

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

(async () => {
  const c = loadCreds();
  const redirectUri = (c.redirect_uris && c.redirect_uris[0]) || "urn:ietf:wg:oauth:2.0:oob";
  const oAuth2Client = new google.auth.OAuth2(c.client_id, c.client_secret, redirectUri);

  if (fs.existsSync(TOKEN_PATH)) {
    console.log(`이미 토큰 측 catch: ${TOKEN_PATH}`);
    console.log("재인증하려면 측 파일을 삭제하고 다시 실행하세요.");
    return;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("=".repeat(80));
  console.log("Google 인증 — 측 URL을 브라우저에서 여세요:");
  console.log("=".repeat(80));
  console.log(authUrl);
  console.log("=".repeat(80));
  console.log("\nallit.platform@gmail.com 로 로그인 → 권한 승인 →");
  console.log("리다이렉트된 URL에서 'code=' 값(또는 페이지에 표시된 코드)을 측 catch 측 catch.\n");

  const code = await prompt("측 입력: ");
  if (!code) { console.error("코드 입력 측 catch X."); process.exit(1); }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log(`\n✅ 측 catch 측 catch: ${TOKEN_PATH}`);
    console.log("이제 scripts/gcal-extract.cjs 측 catch 측 catch 측 catch 측 측 catch.");
  } catch (e) {
    console.error("토큰 측 catch 실패:", e.message);
    process.exit(1);
  }
})();
