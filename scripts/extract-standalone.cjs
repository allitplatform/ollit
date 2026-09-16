const fs = require("fs");
const SRC = "C:\\Users\\butto\\Desktop\\올데이케어 랜딩 (standalone).html";
const OUT = "C:\\Users\\butto\\Desktop\\ollit\\scripts\\standalone-extracted.html";
const lines = fs.readFileSync(SRC, "utf8").split("\n");
const json = JSON.parse(lines[306]);
const html = json.pages["standalone_src.dc"];
fs.writeFileSync(OUT, html);
console.log("SIZE:", html.length, "≈", Math.round(html.length / 1024), "KB");
