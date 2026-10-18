const C = require("../src/core.js");
const D = require("../src/data.json");
let pass = 0, fail = 0; const log = [];
function t(name, cond) { if (cond) pass++; else { fail++; log.push("FAIL " + name); } }
const Q = Object.fromEntries(D.questions.map(q => [q.id, q]));
// 4択
t("mc 正解", C.grade(Q.F06, Q.F06.answer).ok === true);
t("mc 不正解", C.grade(Q.F06, (Q.F06.answer + 1) % 4).ok === false);
// 抜き出し（句読点・かぎの有無を許容）
t("抜き出し かぎ無し", C.grade(Q.E02, "優しくない子供").ok);
t("抜き出し かぎ付き", C.grade(Q.E02, "「優しくない子供」").ok);
t("抜き出し 誤り", !C.grade(Q.E02, "優しい子供").ok);
t("抜き出し 空欄", C.grade(Q.E02, "").ok === false);
t("抜き出し 全角空白", C.grade(Q.E19, " 常識　").ok);
// 漢字
t("読み ひらがな", C.grade(Q.J01, "ゆずる").ok);
t("読み カタカナでも可", C.grade(Q.J01, "ユズル").ok);
t("読み 誤り", !C.grade(Q.J01, "ゆする").ok);
t("書き", C.grade(Q.K03, "権利").ok && !C.grade(Q.K03, "権理").ok);
t("書き 送りがな", C.grade(Q.K05, "必ず").ok);
// キーワード判定
const g1 = C.grade(Q.W01, Q.W01.model);
t("記述 模範解答は満点", g1.ok === true && g1.hit === g1.total);
const g2 = C.grade(Q.W01, "優しくない子供と思われていると感じた。");
t("記述 部分点", g2.ok === false && g2.hit === 2 && C.suggestPoints(g2, 8) === 4);
const long = "あ".repeat(60);
const g3 = C.grade(Q.W01, long);
t("記述 字数オーバー検出", /字数オーバー/.test(g3.note));
t("短答 語句", C.grade(Q.V17s, "自分の都合だけ考えること").ok === true);
t("短答 語句 誤り", C.grade(Q.V17s, "やさしいこと").ok === false);
// 全模範解答が自分のキーワード判定を通るか（品質チェック）
const bad = D.questions.filter(q => (q.type === "short" || q.type === "write") && q.keys.length && C.grade(q, q.model).hit !== q.keys.length);
t("全記述・短答の模範解答がキーワードを満たす " + bad.map(q => q.id).join(","), bad.length === 0);
const badEx = D.questions.filter(q => q.type === "extract" && !C.grade(q, q.model).ok);
t("全抜き出しの模範解答が正解判定 " + badEx.map(q => q.id).join(","), badEx.length === 0);
const badLen = D.questions.filter(q => q.type === "write" && C.limitMax(q.limit) && C.countChars(q.model) > C.limitMax(q.limit));
t("記述 模範解答が字数制限内 " + badLen.map(q => q.id + ":" + C.countChars(q.model) + "/" + q.limit).join(","), badLen.length === 0);
const badMin = D.questions.filter(q => q.type === "write" && C.limitMin(q.limit) && C.countChars(q.model) < C.limitMin(q.limit));
t("記述 模範解答が下限以上 " + badMin.map(q => q.id).join(","), badMin.length === 0);
// 正解位置の偏り
const posCount = [0, 0, 0, 0]; D.questions.filter(q => q.type === "mc").forEach(q => posCount[q.answer]++);
t("正解位置が偏らない " + posCount, Math.min(...posCount) > 20);
// 復習スケジュール
const T0 = new Date("2026-10-18T21:00:00+09:00").getTime();
let r = C.update(null, true, T0, "2026-10-20");
t("初回正解→同日中に再出題", r.next - T0 <= 60 * 60000 && r.streak === 1);
r = C.update(r, true, T0 + 3600e3, "2026-10-20");
t("2回連続正解→試験前に戻ってくる", r.next < new Date("2026-10-20T08:30:00+09:00").getTime());
t("試験3日前以内は2連続で習得", r.mastered === true);
r = C.update(r, false, T0 + 7200e3, "2026-10-20");
t("不正解→連続リセット・5分後", r.streak === 0 && !r.mastered && r.next - (T0 + 7200e3) === 5 * 60000);
const far = new Date("2026-09-01T10:00:00+09:00").getTime();
let r2 = C.update(null, true, far, "2026-10-20"); r2 = C.update(r2, true, far + 1, "2026-10-20"); r2 = C.update(r2, true, far + 2, "2026-10-20");
t("試験が遠いときは3日間隔", Math.round((r2.next - far) / C.DAY) === 3);
t("3連続で習得（通常）", r2.mastered);
t("残り日数", C.daysLeft(T0, "2026-10-20") === 2);
// 出題キュー
const prog = { F06: { n: 1, c: 0, wrong: 1, streak: 0, next: T0 - 1, mastered: false } };
const qu = C.buildQueue(D.questions.filter(q => q.rank === "S"), prog, T0, { seed: 5 });
t("復習期限・間違いの問題が先頭", qu[0] === "F06");
t("キューに重複なし", new Set(qu).size === qu.length);
const qu2 = C.buildQueue(D.questions, {}, T0, { seed: 9, recent: [qu[0], qu[1]] });
t("直前に出た問題は後ろへ", qu2.indexOf(qu[0]) > 100 && qu2.indexOf(qu[1]) > 100);
const rq = C.requeue(["a", "b", "c", "d", "e", "f", "g"], 0, "a", 4);
t("間違いは4問あとに入れ直し", rq[5] === "a" && rq[1] !== "a");
const lim = C.buildQueue(D.questions, {}, T0, { limit: 30, sBoost: 15, seed: 3 });
t("直前30分モード 30問", lim.length === 30);
// 傍線
const parts = C.parsePassage(D.passages.find(p => p.id === "K3").text);
t("傍線パース", parts.filter(x => x.u).length === 5 && parts.find(x => x.u === "⑤").t.startsWith("ただじっと"));
// CSV
const csv = C.toCSV(D.questions, prog);
t("CSV 行数", csv.split("\r\n").length === D.questions.length + 1 && csv.includes('"F06"'));
// 模試
D.exams.forEach(e => t(e.id + " 100点", e.total === 100));
// 統計
const st = C.stats(D.questions, { F06: { n: 2, c: 1, mastered: true, next: T0, wrong: 1 } }, T0);
t("統計 正答率", st.accuracy === 0.5 && st.sRate > 0);
console.log(log.join("\n"));
console.log(`UNIT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
