// 採点・復習・出題順の純粋関数（ブラウザと Node の両方で使う）
(function (root) {
  const DAY = 86400000;
  function toHira(s) { return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)); }
  function norm(s) {
    return (s || "").normalize("NFKC").replace(/[\s　「」『』（）()、。，．,.・…―—\-！!？?〜~]/g, "");
  }
  function countChars(s) { return [...(s || "").replace(/\s/g, "")].length; }
  function limitMax(limit) {
    if (!limit) return null;
    const m = (limit.normalize("NFKC").match(/\d+/g) || []).map(Number);
    return m.length ? Math.max(...m) : null;
  }
  function limitMin(limit) {
    if (!limit) return null;
    const s = limit.normalize("NFKC");
    const m = s.match(/(\d+)字以上/);
    return m ? Number(m[1]) : null;
  }
  // 戻り値: {ok:boolean|null, auto:boolean, hit, total, note}
  function grade(q, ans) {
    if (q.type === "mc") return { ok: ans === q.answer, auto: true };
    const a = norm(ans);
    if (!a) return { ok: false, auto: true, note: "未記入" };
    if (q.type === "extract") {
      const cand = (q.accept || []).map(norm);
      const isYomi = q.cat === "漢字";
      const ok = cand.some(c => c === a || (isYomi && toHira(c) === toHira(a)));
      return { ok, auto: true };
    }
    // short / write: キーワード判定（自己採点で上書き可）
    const groups = q.keys || [];
    let hit = 0;
    const raw = (ans || "").normalize("NFKC");
    const missing = [];
    for (const g of groups) {
      const alts = g[0].split("|");
      if (alts.some(k => raw.includes(k.normalize("NFKC")) || toHira(raw).includes(toHira(k.normalize("NFKC"))))) hit++;
      else missing.push(alts[0]);
    }
    const total = groups.length;
    let note = "";
    const max = limitMax(q.limit), min = limitMin(q.limit), n = countChars(ans);
    let lenOk = true;
    if (q.type === "write" && max && n > max) { lenOk = false; note = `字数オーバー（${n}字／${max}字以内）`; }
    if (q.type === "write" && min && n < min) { lenOk = false; note = `字数不足（${n}字／${min}字以上）`; }
    const ok = total ? hit === total && lenOk : null;
    return { ok, auto: false, hit, total, missing, note, len: n };
  }
  // 記述の推奨点数（満点・部分点）
  function suggestPoints(g, full) {
    if (g.ok === true) return full;
    if (!g.total) return 0;
    const r = g.hit / g.total;
    if (r >= 0.5) return Math.round(full / 2);
    return 0;
  }
  function daysLeft(now, examDate) {
    const ex = new Date(examDate + "T08:30:00+09:00").getTime();
    return Math.max(0, Math.ceil((ex - now) / DAY));
  }
  const BASE = [0, 1, 3, 7]; // 当日→翌日→3日後→7日後
  function update(rec, correct, now, examDate) {
    const r = Object.assign({ n: 0, c: 0, streak: 0, last: 0, next: 0, mastered: false, wrong: 0 }, rec || {});
    r.n++; r.last = now;
    if (correct) {
      r.c++; r.streak++;
      const idx = Math.min(r.streak - 1, BASE.length - 1);
      let iv = BASE[idx] * DAY;
      if (iv === 0) iv = 30 * 60000; // 当日中にもう一度
      const left = daysLeft(now, examDate);
      // 試験前に必ずもう一度出るよう、試験までの日数で間隔を縮める
      if (left > 0) iv = Math.min(iv, Math.max(30 * 60000, (left - 0.5) * DAY / 2));
      r.next = now + iv;
      r.mastered = r.streak >= (left <= 3 ? 2 : 3);
    } else {
      r.streak = 0; r.wrong++; r.mastered = false;
      r.next = now + 5 * 60000;
    }
    return r;
  }
  function isDue(rec, now) { return !!rec && rec.n > 0 && rec.next <= now; }
  function endOfDay(now) { const d = new Date(now); d.setHours(23, 59, 59, 999); return d.getTime(); }
  // 擬似乱数（シード付き）
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function shuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // 出題キュー：期限の来た復習→間違えた問題→未出題→その他。直前に出た問題は後ろへ。
  function buildQueue(qs, prog, now, opts) {
    opts = opts || {};
    const rnd = rng(opts.seed || now);
    const recent = new Set(opts.recent || []);
    const score = q => {
      const r = prog[q.id];
      let s = rnd();
      if (isDue(r, now)) s += 30;
      if (r && r.wrong > 0 && !r.mastered) s += 20;
      if (!r) s += 10;
      if (r && r.mastered && !isDue(r, now)) s -= 20;
      if (q.rank === "S") s += opts.sBoost || 0;
      if (recent.has(q.id)) s -= 50;
      return s;
    };
    let list = shuffle(qs, rnd).map(q => [score(q), q]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    if (opts.limit) list = list.slice(0, opts.limit);
    return list.map(q => q.id);
  }
  // 間違えた問題を少し後ろに入れ直す（連続で同じ問題を出さない）
  function requeue(queue, pos, id, gap) {
    const q = queue.slice();
    const at = Math.min(q.length, pos + 1 + (gap || 4));
    q.splice(at, 0, id);
    return q;
  }
  function stats(qs, prog, now) {
    const pick = f => qs.filter(f);
    const rate = arr => arr.length ? arr.filter(q => prog[q.id] && prog[q.id].mastered).length / arr.length : 0;
    let n = 0, c = 0;
    for (const id in prog) { n += prog[id].n; c += prog[id].c; }
    const eod = endOfDay(now);
    return {
      total: qs.length,
      sRate: rate(pick(q => q.rank === "S")),
      vRate: rate(pick(q => q.cat === "語句")),
      allRate: rate(qs),
      accuracy: n ? c / n : 0,
      answered: n,
      dueToday: qs.filter(q => prog[q.id] && prog[q.id].next <= eod).length,
      wrongCount: qs.filter(q => prog[q.id] && prog[q.id].wrong > 0 && !prog[q.id].mastered).length,
    };
  }
  function toCSV(qs, prog) {
    const esc = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const head = ["問題ID", "分野", "ランク", "難易度", "問題", "解答回数", "正解回数", "正答率", "連続正解", "習得済み", "最終学習", "次回復習"];
    const rows = qs.map(q => {
      const r = prog[q.id] || {};
      const d = t => t ? new Date(t).toLocaleString("ja-JP") : "";
      return [q.id, q.cat, q.rank, q.diff, q.q, r.n || 0, r.c || 0, r.n ? Math.round(r.c / r.n * 100) + "%" : "", r.streak || 0, r.mastered ? "済" : "", d(r.last), d(r.next)].map(esc).join(",");
    });
    return "﻿" + [head.map(esc).join(",")].concat(rows).join("\r\n");
  }
  function parsePassage(text) {
    // {①|...} を分解: [{t:'text'}|{u:'①',t:'...'}]
    const out = []; const re = /\{([^|}]+)\|([^}]*)\}/g; let i = 0, m;
    while ((m = re.exec(text))) { if (m.index > i) out.push({ t: text.slice(i, m.index) }); out.push({ u: m[1], t: m[2] }); i = re.lastIndex; }
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  }
  const api = { norm, toHira, countChars, limitMax, limitMin, grade, suggestPoints, daysLeft, update, isDue, buildQueue, requeue, stats, toCSV, parsePassage, endOfDay, rng, shuffle, DAY };
  if (typeof module !== "undefined") module.exports = api; else root.Core = api;
})(this);
