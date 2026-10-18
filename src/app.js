(function () {
"use strict";
const D = window.APPDATA, C = window.Core;
const ALL = D.questions, QM = Object.fromEntries(ALL.map(q => [q.id, q]));
let QS = ALL, SUBJ = "taketori";
const SUBJECTS = { taketori: "竹取物語", densha: "電車は走る", mix: "総合" };
const PM = Object.fromEntries(D.passages.map(p => [p.id, p]));
const KANA = ["ア", "イ", "ウ", "エ", "オ"];
const MODES = {
  A: { t: "Sランク集中", d: "最重要の予想問題だけ", f: q => q.rank === "S" },
  B: { t: "語句の意味", d: "4択と短答をくり返す", f: q => q.cat === "語句" },
  C: { t: "登場人物別", d: "カズオ・タケシ・ヒナコ・サユリ", f: null },
  D: { t: "傍線部読解", d: "本文の傍線をタップして解く", f: null },
  E: { t: "学校テスト再現", d: "模擬試験3回分（100点）", f: null },
  F: { t: "間違えた問題", d: "まだ習得していない×の問題", f: null },
  I: { t: "漢字 完全習得", d: "新出漢字の書き取りを全問正解まで", f: null },
  J: { t: "語句 全問正解まで", d: "語句の4択を、全部正解するまでくり返す", f: null },
  K: { t: "間違えた語句だけ", d: "×がついた語句だけを復習", f: null },
  G: { t: "全問題ランダム", d: "全分野からまんべんなく", f: q => true },
  H: { t: "試験直前30分", d: "Sランクと未習得を優先して30問", f: null },
  L: { t: "答え自動表示", d: "時間がたつと答えが出て、次へ進む（音声つき）", f: null },
};
// ---------- 保存 ----------
const KEY = "densha-test-v1";
const DEFPREFS = { tate: true, speak: true, rate: 1, autoSec: 10, autoNext: true, autoRange: "S" };
let ST = { prog: {}, recent: [], best: {}, exams: {}, prefs: Object.assign({}, DEFPREFS) };
function load() { try { const s = localStorage.getItem(KEY); if (s) ST = Object.assign(ST, JSON.parse(s)); } catch (e) {} }
function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
function fixPrefs() {
  ST.prefs = Object.assign({}, DEFPREFS, ST.prefs || {});
  if (!ST.prefs.v2) { ST.prefs.tate = true; ST.prefs.v2 = 1; } // 縦書きを標準に（以前の設定も一度だけ縦書きにする）
}
load(); fixPrefs();
function setSubj(sj) { SUBJ = SUBJECTS[sj] ? sj : "taketori"; ST.subj = SUBJ; QS = SUBJ === "mix" ? ALL : ALL.filter(q => q.subj === SUBJ); save(); }
setSubj(ST.subj || "taketori");
function subjOf(q) { return q.subj === "taketori" ? "竹取物語" : "電車は走る"; }
// ---------- 小道具 ----------
const $ = (s, el) => (el || document).querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const main = () => $("#main");
const now = () => Date.now();
function setNav(k) { document.querySelectorAll("nav.bottom button").forEach(b => b.setAttribute("aria-current", b.dataset.go === k ? "true" : "false")); }
function title(t) { $("#ttl").textContent = t; }
function pct(x) { return Math.round(x * 100) + "%"; }
function pageLabel(q) { return q.page && q.page !== "—" ? "教科書 p." + q.page : ""; }
// ---------- 音声読み上げ（ブラウザの日本語音声） ----------
const TTS = window.speechSynthesis;
let VOICE = null, SPK = 0;
function pickVoice() { try { const vs = TTS.getVoices().filter(v => /^ja/i.test(v.lang)); VOICE = vs.find(v => /Kyoko|O-ren|Google/.test(v.name)) || vs[0] || null; } catch (e) {} }
if (TTS) { pickVoice(); try { TTS.addEventListener("voiceschanged", pickVoice); } catch (e) {} }
const MARU = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
function sayText(s) {
  return String(s || "").replace(/[①-⑳]/g, c => (MARU.indexOf(c) + 1) + "、").replace(/[／]/g, "、").replace(/…+|〜/g, "、");
}
function stopSpeak() { SPK++; try { if (TTS) TTS.cancel(); } catch (e) {} }
// 読み終わったら resolve（音声が使えない端末では、すぐ／時間切れで resolve）
function speak(text) {
  stopSpeak();
  if (!TTS || !text || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
  return new Promise(res => {
    const u = new SpeechSynthesisUtterance(sayText(text));
    u.lang = "ja-JP"; if (VOICE) u.voice = VOICE; u.rate = ST.prefs.rate || 1;
    let done = false;
    const fin = () => { if (done) return; done = true; clearTimeout(tm); res(); };
    const tm = setTimeout(fin, 3000 + [...u.text].length * 250 / u.rate);
    u.onend = fin; u.onerror = fin;
    try { TTS.speak(u); } catch (e) { fin(); }
  });
}
function qSpeech(q) {
  let s = q.q;
  if (q.cat === "漢字" && /読み/.test(q.q)) s = "画面の漢字の読みを、ひらがなで書きなさい。"; // 読み上げると答えがわかってしまう
  else if (q.cat === "仮名遣い") s = s.replace(/「([^」]+)」/, (m, w) => "「" + [...w].join("、") + "」");
  else if (q.ctx && (q.cat === "語句" || q.cat === "漢字")) s += "　本文、" + q.ctx;
  if (q.type === "mc") s += "　" + q.choices.map((c, i) => KANA[i] + "、" + c).join("。　");
  return s;
}
function aSpeech(q, head) {
  return (head || "") + (q.type === "mc" ? "正解は、" + KANA[q.answer] + "、" + q.choices[q.answer] : (q.type === "extract" ? "正解は、" : "模範解答は、") + q.model) + "。";
}
function speakChip() { return `<button class="chip noprint" data-act="speak" aria-pressed="${ST.prefs.speak}">音声</button>`; }
// 縦書きの本文で、選ばれている傍線が見える位置まで横にスクロール
function centerBou() {
  main().querySelectorAll(".honbun.tate").forEach(h => {
    const on = h.querySelector(".bou.on"); if (!on) return;
    const hr = h.getBoundingClientRect(), er = on.getBoundingClientRect();
    h.scrollLeft += (er.left + er.width / 2) - (hr.left + hr.width / 2);
  });
}
// ---------- 本文表示 ----------
function passageHTML(pid, opt) {
  opt = opt || {};
  const p = PM[pid]; if (!p) return "";
  const parts = C.parsePassage(p.text);
  const html = parts.map(x => {
    if (!x.u) return esc(x.t);
    const key = pid + "-" + x.u;
    let lab = x.u, cls = "bou";
    if (opt.relabel) { if (!(key in opt.relabel)) return esc(x.t); lab = opt.relabel[key]; }
    if (opt.only && x.u !== opt.only) cls += " dim";
    if (opt.on === x.u) cls += " on";
    return `<span class="${cls}" data-key="${esc(key)}" role="button" tabindex="0"><span class="lab">${esc(lab)}</span>${esc(x.t)}</span>`;
  }).join("");
  const tate = ST.prefs.tate ? " tate" : "";
  const src = p.subj === "taketori" ? "『竹取物語』" : "重松清「電車は走る」";
  return `<div class="honbun${tate}${p.kobun ? " kobun" : ""}${opt.cls ? " " + opt.cls : ""}" data-pid="${pid}">${p.kobun ? `<span class="kb">古文</span>` : ""}${html}<span class="src">（${src} 教科書 p.${esc(p.page)}${p.lines ? "・" + esc(p.lines) : ""}より一部引用）</span></div>`;
}
function tateToggle() {
  return `<button class="chip noprint" data-act="tate" aria-pressed="${ST.prefs.tate}">縦書き</button>`;
}
// ---------- ホーム ----------
function home() {
  setNav("home"); title(SUBJECTS[SUBJ] + (SUBJ === "mix" ? "（2教材）" : ""));
  const s = C.stats(QS, ST.prog, now());
  const dl = C.daysLeft(now(), D.examDate);
  const best = Math.max(0, ...D.exams.filter(e => SUBJ === "mix" ? true : e.subj === SUBJ).map(e => ST.best[e.id] || 0));
  const ranks = { S: 0, A: 0, B: 0 }; QS.forEach(q => ranks[q.rank]++);
  const modes = Object.entries(MODES).filter(([k]) => !(SUBJ === "mix" && k === "C")).map(([k, m]) => `<button class="mode ${k === "A" || k === "H" ? "s" : ""}" data-mode="${k}"><span class="lt">${k}</span><span><b>${m.t}</b><span class="d">${m.d}</span></span></button>`).join("");
  const tabs = Object.entries(SUBJECTS).map(([k, t]) => `<button class="subj" data-subj="${k}" aria-pressed="${k === SUBJ}">${k === "taketori" ? "① " : k === "densha" ? "② " : ""}${t}${k === "mix" ? "（2教材）" : ""}</button>`).join("");
  main().innerHTML = `
  <div class="stack">
    <div class="subjs" role="group" aria-label="教材">${tabs}</div>
    <div class="sheet">
      <div class="route">
        <div class="st now"><i></i><b>きょう</b>${new Date().toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</div>
        <div class="st"><i></i><b>あと${dl}日</b>復習</div>
        <div class="st goal"><i></i><b>中間テスト</b>10月20日〜</div>
      </div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="k">Sランク習得率</div><div class="v">${pct(s.sRate)}</div><div class="bar"><span style="width:${pct(s.sRate)}"></span></div></div>
      <div class="tile"><div class="k">語句の意味 習得率${SUBJ === "taketori" ? "（37語）" : ""}</div><div class="v">${pct(s.vRate)}</div><div class="bar"><span style="width:${pct(s.vRate)}"></span></div></div>
      <div class="tile"><div class="k">今日の復習</div><div class="v">${s.dueToday}<span class="small muted">問</span></div><div class="k">間違えた問題 ${s.wrongCount}問</div></div>
      <div class="tile"><div class="k">総合正答率</div><div class="v">${s.answered ? pct(s.accuracy) : "—"}</div><div class="k">解答 ${s.answered}回</div></div>
      <div class="tile"><div class="k">模擬試験の最高点</div><div class="v">${best ? best : "—"}<span class="small muted">${best ? "点" : ""}</span></div><div class="k">100点満点</div></div>
      <div class="tile"><div class="k">全問題数</div><div class="v">${s.total}<span class="small muted">問</span></div><div class="k">S ${ranks.S}／A ${ranks.A}／B ${ranks.B}</div></div>
    </div>
    <h2>学習モード <span class="small muted">（${SUBJECTS[SUBJ]}）</span></h2>
    <div class="modes">${modes}</div>
    <p class="small muted">「習得」＝連続で正解した問題（試験3日前からは2回連続）。間違えた問題は数問あとにもう一度出ます。記録はこの端末のブラウザに保存されます（「記録」タブでバックアップできます）。</p>
  </div>`;
}
// ---------- 出題セッション ----------
let SES = null;
function startMode(k, extra) {
  const m = MODES[k];
  if (k === "C") return pickChar();
  if (k === "D") return passageList();
  if (k === "E") return examList();
  if (k === "L") return autoSetup();
  let pool, opts = { recent: ST.recent, seed: now() };
  let until = false;
  if (k === "I") {
    pool = QS.filter(q => q.kanji11 || (q.subj === "densha" && q.cat === "漢字" && /^K\d/.test(q.id)));
    until = true; opts.limit = 0;
  } else if (k === "J") {
    pool = QS.filter(q => q.cat === "語句" && q.type === "mc"); until = true;
  } else if (k === "K") {
    pool = QS.filter(q => q.cat === "語句" && ST.prog[q.id] && ST.prog[q.id].wrong > 0 && !ST.prog[q.id].mastered);
    if (!pool.length) { main().innerHTML = `<div class="sheet stack"><h2>間違えた語句はありません</h2><p>「B：語句の意味」か「J：語句 全問正解まで」で練習しましょう。</p><button class="btn pri" data-go="home">ホームへ</button></div>`; return; }
  } else if (k === "F") {
    pool = QS.filter(q => ST.prog[q.id] && ST.prog[q.id].wrong > 0 && !ST.prog[q.id].mastered);
    if (!pool.length) { main().innerHTML = `<div class="sheet stack"><h2>間違えた問題はありません</h2><p>まだ×がついた問題がないか、すべて習得済みです。ほかのモードで解いてみましょう。</p><button class="btn pri" data-go="home">ホームへ</button></div>`; return; }
  } else if (k === "H") {
    pool = QS.filter(q => (q.rank === "S" || !(ST.prog[q.id] && ST.prog[q.id].mastered)) && q.cat !== "原稿用紙");
    opts.sBoost = 15; opts.limit = 30;
  } else if (k === "CH") {
    pool = QS.filter(q => (q.ch || []).includes(extra));
  } else pool = QS.filter(m.f);
  const queue = C.buildQueue(pool, ST.prog, now(), opts);
  SES = { mode: k, label: (k === "CH" ? extra + "の問題" : m.t) + "｜" + SUBJECTS[SUBJ], queue, pos: 0, right: 0, done: 0, until, total0: queue.length };
  showQ();
}
function pickChar() {
  setNav("home"); title("登場人物別");
  const tk = SUBJ === "taketori";
  const names = tk ? ["翁", "媼", "かぐや姫", "帝", "くらもちの皇子", "天人"] : ["カズオ", "タケシ", "ヒナコ", "サユリ", "語り手"];
  const desc = tk ? { 翁: "竹取の翁・育ての親", 媼: "翁の妻・育ての親", かぐや姫: "月の都の者", 帝: "手紙で心を通わせる", くらもちの皇子: "偽りの玉の枝", 天人: "月からの迎え" } : { カズオ: "二人のおばあさん／眠ったふり", タケシ: "おじいさん／唇をかみしめる", ヒナコ: "体調不良／涙", サユリ: "松葉づえのお姉さん／つり革を握りしめる", 語り手: "「僕たち」／「正しさ」" };
  main().innerHTML = `<div class="stack"><h2>誰の場面を練習する？</h2><div class="modes">${names.map(n => `<button class="mode" data-char="${n}"><span class="lt">${n[0]}</span><span><b>${n}</b><span class="d">${desc[n]}（${QS.filter(q => (q.ch || []).includes(n)).length}問）</span></span></button>`).join("")}</div></div>`;
}
// ---------- 答え自動表示モード ----------
const RANGES = {
  S: ["Sランク", q => q.rank === "S"],
  V: ["語句", q => q.cat === "語句" && q.type === "mc"],
  K: ["漢字", q => q.cat === "漢字"],
  W: ["間違えた問題", q => ST.prog[q.id] && ST.prog[q.id].wrong > 0 && !ST.prog[q.id].mastered],
  ALL: ["全問題", q => q.cat !== "原稿用紙"],
};
const AUTO = { t: null, iv: null, paused: false, tok: 0 };
function stopAuto() { clearTimeout(AUTO.t); clearInterval(AUTO.iv); AUTO.t = AUTO.iv = null; AUTO.tok++; }
function prefChips(key, opts) { return opts.map(([v, t]) => `<button class="chip" data-pref="${key}" data-v="${v}" aria-pressed="${String(ST.prefs[key]) === String(v)}">${t}</button>`).join(""); }
function autoSetup() {
  setNav("home"); title("答え自動表示");
  if (!RANGES[ST.prefs.autoRange]) ST.prefs.autoRange = "S";
  main().innerHTML = `<div class="sheet stack"><h2>答え自動表示</h2>
    <p class="small">設問が出て（音声ONなら読み上げのあと）、決めた秒数がたつと答えが自動で出ます。その前に自分で答えてもOK。答えが出たあと「○ わかった／× わからなかった」を押すと記録されます（押さなくても進めます）。</p>
    <div><b>範囲</b><div class="row">${prefChips("autoRange", Object.entries(RANGES).map(([k, [t, f]]) => [k, t + "（" + QS.filter(f).length + "）"]))}</div></div>
    <div><b>答えが出るまで</b><div class="row">${prefChips("autoSec", [[5, "5秒"], [10, "10秒"], [15, "15秒"], [20, "20秒"], [30, "30秒"]])}</div></div>
    <div><b>答えのあと</b><div class="row">${prefChips("autoNext", [[true, "自動で次へ"], [false, "ボタンで次へ"]])}</div></div>
    <div><b>音声</b><div class="row">${prefChips("speak", [[true, "読み上げる"], [false, "読み上げない"]])}</div></div>
    <div class="row"><button class="btn pri" id="autogo">はじめる</button><button class="btn" data-go="home">ホームへ</button></div><div id="automsg" class="small"></div></div>`;
  $("#autogo").onclick = () => {
    const pool = QS.filter(RANGES[ST.prefs.autoRange][1]);
    if (!pool.length) { $("#automsg").textContent = "この範囲の問題はありません。ほかの範囲を選んでください。"; return; }
    const queue = C.buildQueue(pool, ST.prog, now(), { recent: ST.recent, seed: now() });
    SES = { mode: "L", auto: true, label: "答え自動表示｜" + SUBJECTS[SUBJ], queue, pos: 0, right: 0, done: 0, until: false, total0: queue.length };
    AUTO.paused = false; LAST = home;
    showQ(); window.scrollTo(0, 0);
  };
}
function autoQ(q) {
  const tok = AUTO.tok;
  const startCount = () => {
    if (tok !== AUTO.tok || !SES || SES.revealed || AUTO.iv) return;
    const tot = ST.prefs.autoSec * 10; let left = tot;
    const draw = () => { const cd = $("#cd"), ct = $("#cdt"); if (cd) cd.style.width = (1 - left / tot) * 100 + "%"; if (ct) ct.textContent = "答えまで " + Math.ceil(left / 10) + "秒"; };
    draw();
    AUTO.iv = setInterval(() => { if (AUTO.paused) return; left--; draw(); if (left <= 0) { clearInterval(AUTO.iv); reveal(q); } }, 100);
  };
  if (ST.prefs.speak) speak(qSpeech(q)).then(startCount); else startCount();
}
// 答えのあと、自動で次へ（音声があれば読み終わってから）
function autoAdvance(p) {
  if (!SES || !SES.auto) return;
  const tok = AUTO.tok;
  p.then(() => { if (tok !== AUTO.tok || AUTO.paused || !ST.prefs.autoNext) return; AUTO.t = setTimeout(() => { if (tok === AUTO.tok && !AUTO.paused) next(); }, ST.prefs.speak ? 2500 : 5000); });
}
function reveal(q) {
  if (!SES || SES.revealed) return;
  SES.revealed = true; clearInterval(AUTO.iv);
  $("#submit").disabled = true;
  const ta = $("#ans-" + CSS.escape(q.id)); if (ta) ta.readOnly = true;
  if (q.type === "mc") { const box = main().querySelector(".choices"); box.dataset.done = "1"; box.querySelectorAll(".choice").forEach((b, i) => { if (i === q.answer) b.classList.add("right"); }); }
  if ($("#reveal")) $("#reveal").hidden = true;
  if ($("#cdt")) $("#cdt").textContent = "答え";
  const model = q.type === "mc" ? `${KANA[q.answer]}　${esc(q.choices[q.answer])}` : esc(q.model);
  const res = $("#res");
  res.innerHTML = `<div class="result">
    <div class="box green"><h4>${q.type === "mc" ? "正解" : "模範解答"} <button class="chip noprint" id="saya">🔊 答え</button></h4><p class="big">${model}</p></div>
    <div class="box"><h4>解説</h4><p>${esc(q.expl)}</p></div>
    <div class="box red"><h4>わかった？（押すと記録されます）</h4><div class="self" style="margin-top:4px"><button class="btn" data-self="1">○ わかった</button><button class="btn" data-self="0">× わからなかった</button></div></div>
    <div class="row"><button class="btn pri" id="next">次の問題 →</button></div></div>`;
  res.querySelectorAll("[data-self]").forEach(b => b.onclick = () => {
    if (res.dataset.graded) return; res.dataset.graded = "1"; b.setAttribute("aria-pressed", "true");
    const ok = b.dataset.self === "1"; record(q, ok); SES.done++;
    if (ok) SES.right++; else SES.queue = C.requeue(SES.queue, SES.pos, q.id, 4);
  });
  $("#saya").onclick = () => speak(aSpeech(q));
  $("#next").onclick = next;
  autoAdvance(ST.prefs.speak ? speak(aSpeech(q)) : Promise.resolve());
}
function showQ(single) {
  stopAuto(); stopSpeak();
  if (SES) SES.revealed = false;
  const id = single || SES.queue[SES.pos];
  const q = QM[id];
  const auto = !single && SES && SES.auto;
  title(single ? "問題 " + id : SES.label);
  const total = single ? 1 : SES.queue.length;
  const n = single ? 1 : SES.pos + 1;
  let body = "";
  if (q.p) body += passageHTML(q.p, { on: q.u, only: q.u, cls: "inq" });
  if (q.ctx && !q.p) body += `<div class="ctx">${esc(q.scene)}</div>`;
  let ans = "";
  if (q.type === "mc") ans = `<div class="choices">${q.choices.map((c, i) => `<button class="choice" data-ch="${i}"><span class="kn">${KANA[i]}</span><span>${esc(c)}</span></button>`).join("")}</div>`;
  else {
    const isLong = q.type === "write" || q.type === "short";
    ans = isLong ? `<textarea id="ans-${q.id}" placeholder="ここに書く"></textarea><div class="cc" id="cc">0字${q.limit ? "（" + esc(q.limit) + "）" : ""}</div>`
      : `<input type="text" id="ans-${q.id}" autocomplete="off" placeholder="答えを書く">`;
  }
  main().innerHTML = `<div class="stack">
    ${single ? "" : `<div class="progress"><span style="width:${(n - 1) / total * 100}%"></span></div>`}
    <div class="qhead">${single ? "" : SES.until ? `<b>のこり ${total - n + 1}問</b>` : `<b>${n} / ${total}</b>`}<span class="tag ${q.rank}">${q.rank}ランク</span><span class="tag">${esc(q.cat)}</span>${/^補強/.test(q.reason) ? `<span class="tag B">補強</span>` : ""}${SUBJ === "mix" ? `<span class="tag">${subjOf(q)}</span>` : ""}<span>難易度${"★".repeat(q.diff)}</span><span>${esc(pageLabel(q))}</span><span>${esc(q.id)}</span>${q.p ? tateToggle() : ""}${speakChip()}</div>
    ${auto ? `<div class="autobar noprint"><div class="progress"><span id="cd" style="width:0"></span></div><span id="cdt" class="small muted"></span><button class="chip" id="pause" aria-pressed="${AUTO.paused}">${AUTO.paused ? "再開" : "一時停止"}</button><button class="chip" id="reveal">答えを見る</button></div>` : ""}
    ${body}
    <div class="sheet">
      <div class="qtext">${q.p && q.u ? `<span class="tag">傍線${esc(q.u)}</span> ` : ""}${esc(q.q)} <button class="chip noprint" id="sayq" aria-label="設問を読み上げる">🔊 設問</button></div>
      ${q.ctx && q.p ? `<div class="ctx small">${esc(q.scene)}</div>` : ""}
      ${ans}
      <div class="row" style="margin-top:12px"><button class="btn pri" id="submit" ${q.type === "mc" ? "disabled" : ""}>解答する</button>${single ? "" : `<button class="btn" id="skip">とばす</button>`}</div>
      <div id="res"></div>
    </div>
    ${single ? "" : `<div class="row"><button class="btn" data-go="home">やめる（記録は保存済み）</button></div>`}
  </div>`;
  let sel = null;
  main().querySelectorAll(".choice").forEach(b => b.onclick = () => {
    if (b.closest(".choices").dataset.done) return;
    main().querySelectorAll(".choice").forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = Number(b.dataset.ch); $("#submit").disabled = false;
  });
  const ta = $("#ans-" + CSS.escape(q.id));
  if (ta && $("#cc")) ta.oninput = () => { const c = C.countChars(ta.value), mx = C.limitMax(q.limit); $("#cc").textContent = c + "字" + (q.limit ? "（" + q.limit + "）" : ""); $("#cc").classList.toggle("over", !!(mx && c > mx)); };
  if (ta && ta.tagName === "INPUT") ta.onkeydown = e => { if (e.key === "Enter") $("#submit").click(); };
  $("#submit").onclick = () => answer(q, q.type === "mc" ? sel : ta.value, single);
  if ($("#skip")) $("#skip").onclick = () => next();
  $("#sayq").onclick = () => speak(qSpeech(q));
  centerBou();
  if (auto) {
    $("#reveal").onclick = () => { stopSpeak(); reveal(q); };
    $("#pause").onclick = () => {
      const b = $("#pause"); AUTO.paused = !AUTO.paused;
      b.textContent = AUTO.paused ? "再開" : "一時停止"; b.setAttribute("aria-pressed", AUTO.paused);
      if (AUTO.paused) { stopSpeak(); clearTimeout(AUTO.t); }
      else if (SES.revealed) autoAdvance(Promise.resolve());
    };
    autoQ(q);
  } else if (ST.prefs.speak) speak(qSpeech(q));
}
function record(q, ok) {
  ST.prog[q.id] = C.update(ST.prog[q.id], ok, now(), D.examDate);
  ST.recent = [q.id].concat(ST.recent.filter(x => x !== q.id)).slice(0, 12);
  save();
}
function answer(q, val, single) {
  const g = C.grade(q, val);
  const auto = !single && SES && SES.auto;
  if (auto) { if (SES.revealed) return; SES.revealed = true; clearInterval(AUTO.iv); if ($("#reveal")) $("#reveal").hidden = true; if ($("#cdt")) $("#cdt").textContent = "答え"; }
  $("#submit").disabled = true;
  const res = $("#res");
  let markHTML, selfHTML = "";
  if (q.type === "mc") {
    const box = main().querySelector(".choices"); box.dataset.done = "1";
    box.querySelectorAll(".choice").forEach((b, i) => { if (i === q.answer) b.classList.add("right"); else if (i === val) b.classList.add("wrong"); });
  }
  if (g.auto) { markHTML = g.ok ? `<span class="m">○</span><b>正解</b>` : `<span class="m ng">×</span><b>不正解</b>`; }
  else {
    const kw = g.total ? `キーワード ${g.hit}/${g.total}${g.missing && g.missing.length ? "（足りない：" + g.missing.join("・") + "）" : ""}` : "";
    markHTML = `<span class="m ${g.ok ? "" : "ng"}">${g.ok ? "○" : "△"}</span><span><b>${g.ok ? "キーワードOK" : "自己採点してください"}</b><br><span class="small muted">${esc(kw)} ${esc(g.note || "")}</span></span>`;
    selfHTML = `<div class="box red"><h4>自己採点（模範解答と見くらべて、意味が合っていれば○）</h4><div class="self" style="margin-top:4px"><button class="btn" data-self="1">○ 正解にする</button><button class="btn" data-self="0">× まちがい</button></div></div>`;
  }
  const whys = q.type === "mc" ? `<div class="box"><h4>選択肢の説明</h4><ul class="why">${q.choices.map((c, i) => `<li><b>${KANA[i]}</b> ${i === q.answer ? "<b>正解</b>" : esc(q.why[i])}</li>`).join("")}</ul></div>` : "";
  const rel = (q.rel || []).filter(r => QM[r]).map(r => `<a data-open="${r}">${r}</a>`).join("");
  const model = q.type === "mc" ? `${KANA[q.answer]}　${esc(q.choices[q.answer])}` : esc(q.model) + (q.accept && q.accept.length > 1 && q.cat !== "漢字" ? `<br><span class="small muted">別解：${q.accept.slice(1).map(esc).join("／")}</span>` : "");
  res.innerHTML = `<div class="result">
    <div class="mark">${markHTML}</div>
    <div class="box green"><h4>${q.type === "mc" ? "正解" : "模範解答"} <button class="chip noprint" id="saya">🔊 答え</button></h4><p>${model}</p></div>
    ${selfHTML}
    <div class="box"><h4>解説</h4><p>${esc(q.expl)}</p>${q.infer ? `<p class="small muted">※本文にはっきり書かれていない部分を、本文の言葉から推し量る問題です。</p>` : ""}</div>
    ${whys}
    <div class="box"><h4>根拠の場面・出題予想の理由</h4><p class="small">${esc(pageLabel(q))}　${esc(q.scene)}<br>${q.rank}ランク：${esc(q.reason)}</p></div>
    ${rel ? `<div class="box rel"><h4>関連問題</h4>${rel}</div>` : ""}
    ${q.p ? `<div><button class="btn" data-backto="${q.p}" data-u="${esc(q.u || "")}">本文で前後を確認する</button></div>` : ""}
    <div class="row">${single ? `<button class="btn pri" data-go="back">もどる</button>` : `<button class="btn pri" id="next" ${g.auto ? "" : "disabled"}>次の問題 →</button>`}</div>
  </div>`;
  const finish = ok => {
    record(q, ok);
    if (!single) { SES.done++; if (ok) SES.right++; else SES.queue = SES.until ? SES.queue.concat([q.id]) : C.requeue(SES.queue, SES.pos, q.id, 4); const nb = $("#next"); if (nb) nb.disabled = false; }
  };
  if (g.auto) finish(!!g.ok);
  else res.querySelectorAll("[data-self]").forEach(b => b.onclick = () => {
    if (res.dataset.graded) return; res.dataset.graded = "1";
    b.setAttribute("aria-pressed", "true"); finish(b.dataset.self === "1");
  });
  if ($("#next")) $("#next").onclick = next;
  $("#saya").onclick = () => speak(aSpeech(q));
  const head = g.auto ? (g.ok ? "正解。" : "不正解。") : "";
  const p = ST.prefs.speak ? speak(aSpeech(q, head)) : Promise.resolve();
  if (auto && g.auto) autoAdvance(p);
  res.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function next() {
  SES.pos++;
  if (SES.pos >= SES.queue.length) return endSession();
  showQ();
  window.scrollTo(0, 0);
}
function endSession() {
  const r = SES;
  main().innerHTML = `<div class="sheet stack"><h2>${r.until ? "全問正解しました！" : "おつかれさま！"}</h2><p class="score">${r.right}<span class="small muted">／${r.done}回 正解</span></p>${r.until ? `<p>${r.total0}問すべてに正解するまでくり返しました。</p>` : ""}<p>間違えた問題は「F：間違えた問題」と「今日の復習」に入りました。</p><div class="row"><button class="btn pri" data-mode="${r.mode === "CH" ? "C" : r.mode}">もう一度</button><button class="btn" data-go="home">ホームへ</button></div></div>`;
  SES = null;
}
// ---------- 傍線部読解 ----------
let BACK = null;
function passageList() {
  setNav("honbun"); title("傍線部読解");
  main().innerHTML = `<div class="stack"><h2>本文をえらぶ</h2><p class="small muted">本文の傍線部をタップすると、その傍線の問題が出ます。</p>
  <div class="modes">${D.passages.filter(p => SUBJ === "mix" || p.subj === SUBJ).map(p => { const n = QS.filter(q => q.p === p.id).length; return `<button class="mode" data-pass="${p.id}"><span class="lt">${p.title[0]}</span><span><b>${esc(p.title)}</b><span class="d">${SUBJ === "mix" ? (p.subj === "taketori" ? "竹取物語・" : "電車は走る・") : ""}p.${esc(p.page)}　問題${n}問${p.kobun ? "・古文" : ""}</span></span></button>`; }).join("")}</div></div>`;
}
function passageView(pid, hl) {
  setNav("honbun");
  const p = PM[pid]; title(p.title);
  const qs = QS.filter(q => q.p === pid);
  const byU = {}; qs.forEach(q => { const k = q.u || "全体"; (byU[k] = byU[k] || []).push(q); });
  const list = Object.entries(byU).map(([u, arr]) => `<div class="sheet" id="u-${esc(u)}"><div class="qhead"><b>${u === "全体" ? "この場面全体" : "傍線" + esc(u)}</b><span>${arr.length}問</span></div><div class="stack" style="gap:6px;margin-top:6px">${arr.map(q => { const r = ST.prog[q.id]; const st = r ? (r.mastered ? "習得" : r.wrong && r.streak === 0 ? "×" : "○") : "未"; return `<button class="choice" data-open="${q.id}" data-from="${pid}"><span class="kn">${st}</span><span>${esc(q.q)} <span class="tag ${q.rank}">${q.rank}</span></span></button>`; }).join("")}</div></div>`).join("");
  main().innerHTML = `<div class="stack"><div class="row">${tateToggle()}<span class="small muted">p.${esc(p.page)} ${esc(p.lines)}</span></div>${passageHTML(pid, { on: hl })}<h3>傍線ごとの問題</h3>${list}<div class="row">${SES ? `<button class="btn pri" data-resume="1">練習にもどる</button>` : ""}<button class="btn" data-pass-list="1">本文一覧へ</button></div></div>`;
  main().querySelectorAll(".bou").forEach(el => {
    const go = () => { const u = el.dataset.key.split("-")[1]; const t = document.getElementById("u-" + u); main().querySelectorAll(".bou").forEach(x => x.classList.toggle("on", x === el)); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); };
    el.onclick = go; el.onkeydown = e => { if (e.key === "Enter") go(); };
  });
  if (hl) { const el = main().querySelector(`.bou[data-key="${CSS.escape(pid + "-" + hl)}"]`); if (el) el.scrollIntoView({ block: "center" }); centerBou(); }
}
// ---------- 模擬試験 ----------
let EX = null;
function examList() {
  setNav("exam"); title("学校テスト再現");
  main().innerHTML = `<div class="stack"><h2>模擬試験</h2>
  <p class="small">${SUBJ === "taketori" ? "竹取物語の模擬試験です。過去問（一学期期末）には古文がなかったため、仮名遣い・現代語訳・主語の問題は補強として加えています。" : SUBJ === "mix" ? "総合模試：大問一 電車は走る、大問二 竹取物語、大問三 原稿用紙。" : ""}過去問（一学期期末）と同じ組み立てです：各大問の問1 漢字（a〜j）、問2 語句の意味（ⅰ〜ⅳ）、問3以降 傍線部(A)(B)…の読解・抜き出し・記述、大問三 原稿用紙。</p>
  <div class="note small">配点・制限時間は過去問に書かれていないため推定です（漢字1点、語句2点、選択・抜き出し3点、短答4点、記述5〜10点、50分）。過去問の語句問題は3択でしたが、ここでは4択で少し難しくしています。</div>
  <div class="modes">${D.exams.filter(e => SUBJ === "mix" ? e.subj === "mix" : e.subj === SUBJ).concat(SUBJ === "mix" ? D.exams.filter(e => e.subj !== "mix") : []).map(e => `<button class="mode s" data-exam="${e.id}"><span class="lt">${e.id[1]}</span><span><b>${esc(e.title)}</b><span class="d">${e.time}分・100点${ST.best[e.id] != null ? "・最高 " + ST.best[e.id] + "点" : ""}</span></span></button>`).join("")}</div>
  <p class="small muted">紙で解きたいときは、一緒に渡した印刷用PDF（問題用紙・解答用紙・模範解答）を使ってください。</p></div>`;
}
const ROMAN = ["ⅰ", "ⅱ", "ⅲ", "ⅳ", "ⅴ"];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function examLayout(ex) {
  // 大問ごとに傍線ラベル (A)(B)… を振り直す
  return ex.sections.map(s => {
    const relabel = {}; let li = 0; const passages = [];
    s.items.forEach(id => { const q = QM[id]; if (q.p && passages.indexOf(q.p) < 0) passages.push(q.p); if (q.p && q.u) { const k = q.p + "-" + q.u; if (!(k in relabel)) relabel[k] = "(" + ALPHA[li++] + ")"; } });
    passages.sort((a, b) => D.passages.findIndex(p => p.id === a) - D.passages.findIndex(p => p.id === b));
    return { s, relabel, passages };
  });
}
function qRef(q, relabel) { return q.p && q.u ? relabel[q.p + "-" + q.u] : ""; }
function examQText(q, relabel) {
  let t = q.q;
  if (q.u) t = t.replace(new RegExp("傍線" + q.u, "g"), "傍線部" + relabel[q.p + "-" + q.u]);
  return t;
}
function startExam(id) {
  const ex = D.exams.find(e => e.id === id);
  setNav("exam"); title(ex.title);
  EX = { ex, start: now(), ans: {}, self: {}, graded: false };
  const lay = examLayout(ex);
  let html = `<div class="stack exam"><div class="timer noprint" id="timer">残り ${ex.time}:00</div><p class="small">※答えは丁寧に、解答欄に収まるように書くこと。＊数字や記号は、すべて一字とします。</p>`;
  lay.forEach(({ s, relabel, passages }) => {
    let qn = 1;
    html += `<h2 class="dai"><span class="no">${s.name}</span><span>${esc(s.title)}</span><span class="small muted" style="margin-left:auto">${s.sum}点</span></h2>`;
    if (passages.length) html += `<div class="row">${tateToggle()}</div>` + passages.map(pid => passageHTML(pid, { relabel })).join("");
    if (s.kanji.length) {
      html += `<div class="eq"><span class="qn">問${qn++}</span>a〜${"abcdefghij"[s.kanji.length - 1]}の漢字の読みをひらがなで、カタカナを漢字に直しなさい。<span class="pt">各1点</span><div class="kanji-grid" style="margin-top:8px">${s.kanji.map((id, i) => { const q = QM[id]; const ctx = esc(q.ctx).replace(esc(q.word.replace(/[ぁ-ん]+$/, "")), m => `<em>${m}</em>`); return `<label class="kj" for="ea-${id}"><span><b>${"abcdefghij"[i]}</b>　${esc(q.word)}${q.id[0] === "J" ? "（読み）" : "（漢字に）"}</span><span class="c small">${ctx}</span><input type="text" id="ea-${id}" data-q="${id}" autocomplete="off"><span class="er small" id="er-${id}"></span></label>`; }).join("")}</div></div>`;
    }
    if (s.vocab.length) {
      html += `<div class="eq"><span class="qn">問${qn++}</span>（ⅰ）〜（${ROMAN[s.vocab.length - 1]}）の語句の本文中の意味として最も適切なものを選び、記号で答えなさい。<span class="pt">各2点</span>${s.vocab.map((id, i) => { const q = QM[id]; return `<div style="margin-top:10px"><b>（${ROMAN[i]}）${esc(q.word)}</b> <span class="small muted">本文：「${esc(q.ctx)}」</span>${choicesExam(q)}<div class="er small" id="er-${id}"></div></div>`; }).join("")}</div>`;
    }
    s.items.forEach(id => {
      const q = QM[id];
      html += `<div class="eq"><span class="qn">問${qn++}</span>${esc(examQText(q, relabel))}<span class="pt">${s.points[id]}点</span>`;
      if (q.type === "mc") html += choicesExam(q);
      else if (q.type === "extract") html += `<input type="text" id="ea-${id}" data-q="${id}" autocomplete="off" style="margin-top:6px">`;
      else html += `<textarea id="ea-${id}" data-q="${id}" style="margin-top:6px"></textarea><div class="cc" data-cc="${id}">0字${q.limit ? "（" + esc(q.limit) + "）" : ""}</div>`;
      html += `<div class="er small" id="er-${id}"></div></div>`;
    });
  });
  html += `<div class="row noprint"><button class="btn red" id="grade">採点する</button><button class="btn" data-go="exam">やめる</button></div><div id="exres"></div></div>`;
  main().innerHTML = html;
  main().querySelectorAll("[data-mc]").forEach(b => b.onclick = () => { if (EX.graded) return; const id = b.dataset.mc; EX.ans[id] = Number(b.dataset.i); b.parentNode.querySelectorAll(".choice").forEach(x => x.classList.toggle("sel", x === b)); });
  main().querySelectorAll("input[data-q],textarea[data-q]").forEach(t => t.oninput = () => { EX.ans[t.dataset.q] = t.value; const cc = main().querySelector(`[data-cc="${t.dataset.q}"]`); if (cc) { const q = QM[t.dataset.q], c = C.countChars(t.value), mx = C.limitMax(q.limit); cc.textContent = c + "字" + (q.limit ? "（" + q.limit + "）" : ""); cc.classList.toggle("over", !!(mx && c > mx)); } });
  $("#grade").onclick = gradeExam;
  clearInterval(window.__tm);
  window.__tm = setInterval(() => { const el = $("#timer"); if (!el || EX.graded) return clearInterval(window.__tm); const left = ex.time * 60 - Math.floor((now() - EX.start) / 1000); el.textContent = left > 0 ? `残り ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "時間です（そのまま続けてもOK）"; }, 1000);
}
function choicesExam(q) {
  return `<div class="choices">${q.choices.map((c, i) => `<button class="choice" data-mc="${q.id}" data-i="${i}"><span class="kn">${KANA[i]}</span><span>${esc(c)}</span></button>`).join("")}</div>`;
}
function gradeExam() {
  if (EX.graded) return; EX.graded = true;
  const ex = EX.ex; let auto = 0, pend = [];
  ex.sections.forEach(s => {
    Object.entries(s.points).forEach(([id, pt]) => {
      const q = QM[id], val = EX.ans[id], g = C.grade(q, q.type === "mc" ? (val == null ? -1 : val) : (val || ""));
      const er = $("#er-" + CSS.escape(id));
      if (q.type === "mc") main().querySelectorAll(`[data-mc="${CSS.escape(id)}"]`).forEach((b, i) => { if (i === q.answer) b.classList.add("right"); else if (i === val) b.classList.add("wrong"); });
      if (g.auto) {
        if (g.ok) auto += pt;
        record(q, !!g.ok);
        er.innerHTML = `<span style="color:var(--red);font-weight:700">${g.ok ? "○ " + pt + "点" : "× 0点"}</span>　正解：${q.type === "mc" ? KANA[q.answer] + " " + esc(q.choices[q.answer]) : esc(q.model)}<details><summary class="small">解説</summary><p class="small">${esc(q.expl)}</p></details>`;
      } else {
        const sug = C.suggestPoints(g, pt);
        EX.self[id] = sug; pend.push(id);
        er.innerHTML = `<div class="box red" style="margin-top:6px"><h4>模範解答（自己採点）</h4><p>${esc(q.model)}</p><p class="small muted">${esc(q.expl)}</p><p class="small">キーワード ${g.hit}/${g.total} ${esc(g.note || "")}</p><div class="self">${[pt, Math.round(pt / 2), 0].filter((v, i, a) => a.indexOf(v) === i).map(v => `<button class="btn" data-sp="${id}" data-v="${v}" aria-pressed="${v === sug}">${v}点</button>`).join("")}</div></div>`;
      }
    });
  });
  EX.auto = auto;
  const upd = () => {
    const tot = EX.auto + Object.values(EX.self).reduce((a, b) => a + b, 0);
    $("#exres").innerHTML = `<div class="sheet stack"><div class="row"><span class="score">${tot}</span><span>／100点</span></div><p class="small">自動採点 ${EX.auto}点 ＋ 記述（自己採点）${tot - EX.auto}点。記述の点数ボタンを押すと合計が変わります。</p><div class="row"><button class="btn pri" id="saveex">この点数を記録する</button><button class="btn" data-go="exam">試験一覧へ</button></div></div>`;
    $("#saveex").onclick = () => {
      ST.best[ex.id] = Math.max(ST.best[ex.id] || 0, tot);
      ST.exams[ex.id] = (ST.exams[ex.id] || []).concat([{ t: now(), score: tot }]);
      pend.forEach(id => record(QM[id], EX.self[id] >= Math.ceil(ex.sections.find(s => id in s.points).points[id] * 0.75)));
      save(); $("#saveex").disabled = true; $("#saveex").textContent = "記録しました";
    };
    return tot;
  };
  main().querySelectorAll("[data-sp]").forEach(b => b.onclick = () => { EX.self[b.dataset.sp] = Number(b.dataset.v); b.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); upd(); });
  upd();
  $("#exres").scrollIntoView({ behavior: "smooth" });
  $("#grade").disabled = true;
}
// ---------- 一覧 ----------
function lists(tab) {
  setNav("list");
  tab = tab || "S";
  const tabs = [["S", "Sランク一覧"], ["V", "語句の意味一覧"], ["J", "漢字一覧"], ["ALL", "全問題"]];
  title("一覧｜" + SUBJECTS[SUBJ]);
  let body = "";
  if (tab === "V") {
    const vs = QS.filter(q => q.cat === "語句" && q.type === "mc");
    if (SUBJ === "mix") vs.sort((a, b) => (a.subj < b.subj) - (a.subj > b.subj));
    body = `<div class="tbl"><table><thead><tr><th>語句</th><th>本文中の意味</th><th>ページ</th><th>注意</th></tr></thead><tbody>${vs.map(q => `<tr><td><b>${esc(q.word)}</b> <span class="tag ${q.rank}">${q.rank}</span></td><td>${esc(q.model)}</td><td class="n">${esc(q.page)}</td><td class="small">${esc((q.expl.split("【注意】")[1]) || "")}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (tab === "J") {
    const js = QS.filter(q => q.cat === "漢字");
    body = `<div class="tbl"><table><thead><tr><th>問題</th><th>答え</th><th>本文</th><th>ページ</th></tr></thead><tbody>${js.map(q => `<tr><td>${esc(q.word)}</td><td><b>${esc(q.model)}</b></td><td class="small">${esc(q.ctx)}</td><td class="n">${esc(q.page)}</td></tr>`).join("")}</tbody></table></div>`;
  } else {
    const arr = tab === "S" ? QS.filter(q => q.rank === "S") : QS;
    body = `<input type="text" id="flt" placeholder="しぼりこみ（例：サユリ、心情、F0）"><div class="tbl" style="margin-top:8px"><table><thead><tr><th>ID</th><th>分野</th><th>問題</th><th>答え</th><th>p.</th><th>記録</th></tr></thead><tbody id="tb">${arr.map(q => { const r = ST.prog[q.id]; return `<tr data-s="${esc(q.id + q.cat + q.q + (q.ch || []).join(""))}"><td class="n"><a class="rel" data-open="${q.id}">${q.id}</a> <span class="tag ${q.rank}">${q.rank}</span></td><td class="n">${esc(q.cat)}</td><td>${esc(q.q)}</td><td class="small">${q.type === "mc" ? KANA[q.answer] + "　" + esc(q.choices[q.answer]) : esc(q.model)}</td><td class="n">${esc(q.page)}</td><td class="n">${r ? r.c + "/" + r.n + (r.mastered ? " 習得" : "") : "—"}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  main().innerHTML = `<div class="stack"><div class="row">${tabs.map(([k, t]) => `<button class="chip" data-list="${k}" aria-pressed="${k === tab}">${t}</button>`).join("")}</div>${body}</div>`;
  const f = $("#flt"); if (f) f.oninput = () => { const v = f.value.trim(); main().querySelectorAll("#tb tr").forEach(tr => tr.hidden = v && !tr.dataset.s.includes(v)); };
}
// ---------- 記録（バックアップ） ----------
function dataView() {
  setNav("data"); title("記録とバックアップ");
  const s = C.stats(QS, ST.prog, now());
  main().innerHTML = `<div class="stack">
  <div class="sheet"><b>いまの記録</b><p class="small">解答 ${s.answered}回・正答率 ${s.answered ? pct(s.accuracy) : "—"}・習得 ${pct(s.allRate)}・模試 ${Object.entries(ST.best).map(([k, v]) => k + ":" + v + "点").join(" ") || "未受験"}</p></div>
  <div class="sheet stack"><b>バックアップ</b><p class="small">下の文字をコピーして、メモアプリなどに貼りつけて保存します。</p><textarea id="bk" readonly style="min-height:7em;font-family:monospace;font-size:.75rem"></textarea><div class="row"><button class="btn pri" id="cp">コピー</button></div></div>
  <div class="sheet stack"><b>復元</b><p class="small">保存しておいた文字を貼りつけるか、ファイルを選んで「復元する」を押します。</p><textarea id="rs" style="min-height:5em;font-family:monospace;font-size:.75rem" placeholder="ここに貼りつけ"></textarea><input type="file" id="rf" accept=".json,.txt,application/json,text/plain"><div class="row"><button class="btn" id="rsb">復元する</button><span id="rsm" class="small"></span></div></div>
  <div class="sheet stack"><b>CSV（表計算ソフト用）</b><textarea id="csv" readonly style="min-height:5em;font-family:monospace;font-size:.72rem"></textarea><div class="row"><button class="btn" id="cpcsv">CSVをコピー</button></div></div>
  <div class="sheet stack"><b>記録を消す</b><div id="rz"><button class="btn" id="rst">すべての記録を消す…</button></div></div>
  <div class="sheet stack"><b>表示</b><div class="row"><button class="chip" data-act="tate" aria-pressed="${ST.prefs.tate}">本文を縦書きで表示</button></div></div>
  <div class="sheet stack"><b>音声</b><div class="row">${prefChips("speak", [[true, "設問と答えを読み上げる"], [false, "読み上げない"]])}</div>
    <div class="row"><span class="small">速さ</span>${prefChips("rate", [[0.8, "ゆっくり"], [1, "ふつう"], [1.2, "はやい"]])}<button class="chip" id="vtest">🔊 試しに聞く</button></div>
    <p class="small muted">端末の日本語音声で読み上げます${TTS ? "" : "（このブラウザは読み上げに対応していません）"}。iPhoneは消音モード（横のスイッチ）だと鳴らないことがあります。漢字の読み問題は、答えがわからないよう漢字を読み上げません。</p></div>
  </div>`;
  $("#vtest").onclick = () => speak("竹取の翁という者がいた。音声のテストです。");
  $("#bk").value = JSON.stringify({ app: "densha", v: 1, at: new Date().toISOString(), data: ST });
  $("#csv").value = C.toCSV(ALL, ST.prog).replace(/^﻿/, "");
  const copy = (ta, btn) => { const done = () => { btn.textContent = "コピーしました"; }; try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); done(); }); } catch (e) { ta.select(); } };
  $("#cp").onclick = () => copy($("#bk"), $("#cp"));
  $("#cpcsv").onclick = () => copy($("#csv"), $("#cpcsv"));
  $("#rf").onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $("#rs").value = r.result; }; r.readAsText(f); };
  $("#rsb").onclick = () => {
    try { const o = JSON.parse($("#rs").value); if (!o || o.app !== "densha" || !o.data || !o.data.prog) throw 0; ST = Object.assign({ prog: {}, recent: [], best: {}, exams: {}, prefs: Object.assign({}, DEFPREFS) }, o.data); fixPrefs(); save(); $("#rsm").textContent = "復元しました（" + Object.keys(ST.prog).length + "問分）"; }
    catch (e) { $("#rsm").textContent = "読みこめませんでした。バックアップの文字を全部貼りつけてください。"; }
  };
  $("#rst").onclick = () => { $("#rz").innerHTML = `<div class="confirm"><p>本当に消しますか？ 元に戻せません。</p><div class="row"><button class="btn red" id="rsty">消す</button><button class="btn" id="rstn">やめる</button></div></div>`; $("#rsty").onclick = () => { ST = { prog: {}, recent: [], best: {}, exams: {}, prefs: ST.prefs }; save(); dataView(); }; $("#rstn").onclick = dataView; };
}
// ---------- 使い方・分析 ----------
function help() {
  setNav("help"); title("使い方・出題分析");
  main().innerHTML = $("#helptpl").innerHTML;
}
// ---------- ルーティング ----------
let LAST = home;
document.addEventListener("click", e => {
  const t = e.target.closest("[data-subj],[data-resume],[data-go],[data-mode],[data-char],[data-pass],[data-pass-list],[data-exam],[data-open],[data-backto],[data-list],[data-act],[data-pref]");
  if (!t) return;
  const d = t.dataset;
  if (d.act === "tate") { ST.prefs.tate = !ST.prefs.tate; save(); main().querySelectorAll(".honbun").forEach(h => h.classList.toggle("tate", ST.prefs.tate)); document.querySelectorAll('[data-act="tate"]').forEach(b => b.setAttribute("aria-pressed", ST.prefs.tate)); centerBou(); return; }
  if (d.act === "speak") { ST.prefs.speak = !ST.prefs.speak; save(); if (!ST.prefs.speak) stopSpeak(); document.querySelectorAll('[data-act="speak"]').forEach(b => b.setAttribute("aria-pressed", ST.prefs.speak)); return; }
  if (d.pref) {
    const v = d.v; ST.prefs[d.pref] = v === "true" ? true : v === "false" ? false : isNaN(v) ? v : Number(v); save();
    document.querySelectorAll(`[data-pref="${d.pref}"]`).forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v));
    if (d.pref === "speak" && !ST.prefs.speak) stopSpeak();
    return;
  }
  stopAuto(); stopSpeak();
  if (d.subj) { setSubj(d.subj); SES = null; home(); return; }
  if (d.go === "back") { return LAST(); }
  if (d.resume) { if (SES) { showQ(); window.scrollTo(0, 0); } return; }
  if (d.go) { const f = { home, honbun: passageList, exam: examList, list: () => lists(), data: dataView, help }[d.go]; if (f) { SES = null; LAST = f; f(); window.scrollTo(0, 0); } return; }
  if (d.mode) { LAST = home; startMode(d.mode); window.scrollTo(0, 0); return; }
  if (d.char) { startMode("CH", d.char); return; }
  if (d.pass) { LAST = () => passageView(d.pass); passageView(d.pass); window.scrollTo(0, 0); return; }
  if (d.passList) { passageList(); return; }
  if (d.exam) { startExam(d.exam); window.scrollTo(0, 0); return; }
  if (d.list) { lists(d.list); return; }
  if (d.backto) { passageView(d.backto, d.u); return; }
  if (d.open) {
    if (EX && !EX.graded && $("#grade")) return; // 試験中は移動しない
    const from = d.from;
    if (from) LAST = () => passageView(from);
    else if (SES) { const keep = SES; LAST = () => { SES = keep; showQ(); }; SES = null; }
    showQ(d.open); window.scrollTo(0, 0); return;
  }
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !/claude|anthropic/.test(location.hostname)) {
  try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) {}
}
window.__app = { setSubj, get SUBJ() { return SUBJ; }, get QS() { return QS; }, startMode, startExam, showQ, gradeExam, passageView, lists, dataView, help, home, get ST() { return ST; }, get SES() { return SES; }, get EX() { return EX; } };
try { document.getElementById("cnt").innerHTML = "テストまで<b>" + C.daysLeft(now(), D.examDate) + "</b>日"; } catch (e) {}
home();
})();
