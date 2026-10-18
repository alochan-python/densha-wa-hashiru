import json, hashlib, re, sys
sys.path.insert(0, '.')
from qhelp import Q
import q_read1, q_read2
from passages import PASSAGES
from q_vocab import VOCAB
from q_kanji import YOMI, KAKI

KANA = "アイウエ"
def pos(i, n=4):
    return int(hashlib.md5(i.encode()).hexdigest(), 16) % n

out = []
# ---- 語句 ----
for (vid, w, page, ctx, mean, wr, trap, rank, diff, ch, keys) in VOCAB:
    out.append(dict(id=vid, cat="語句", rank=rank, diff=diff, type="mc",
        q=f"「{w}」の本文中の意味として最も適切なものを選びなさい。",
        ctx=ctx, ok=mean, wrongs=wr, expl=f"本文中の意味：{mean}。" + (f"【注意】{trap}" if trap else ""),
        page=page, scene="本文：「" + ctx + "」", reason="過去問では各大問の問2で「語句の意味」が毎回出題（ア・イ・ウの3択）。本文に出てくる語句", ch=ch, rel=[vid+"s"] if keys else [], word=w, model=mean))
    if keys:
        out.append(dict(id=vid+"s", cat="語句", rank="A" if rank=="S" else rank, diff=min(3, diff+1), type="short",
            q=f"「{w}」の本文中の意味を、十〜二十五字程度で答えなさい。", ctx=ctx, model=mean, keys=keys,
            expl=f"意味が合っていれば正解。キーワード：{'・'.join(k[0].split('|')[0] for k in keys)}。" + (f"【注意】{trap}" if trap else ""),
            page=page, scene="本文：「" + ctx + "」", reason="意味を自分の言葉で答える練習（記述型の語句問題への備え）", ch=ch, rel=[vid], word=w, accept=[]))
# ---- 漢字 ----
for (jid, w, yomi, page, ctx, rank) in YOMI:
    out.append(dict(id=jid, cat="漢字", rank="A" if rank=="S" else rank, diff=1, type="extract", q=f"「{w}」の読みをひらがなで書きなさい。",
        ctx=ctx, model=yomi, accept=[yomi], expl=f"{w}（{yomi}）。教科書ではふりがなつきの語。", page=page,
        scene="本文：「" + ctx + "」", reason="過去問では各大問の問1で漢字（読み・書き）を10問出題", ch=[], rel=[], word=w, keys=[]))
for (kid, kata, kan, page, ctx, rank) in KAKI:
    stem = re.sub(r'[ぁ-ん]+$', '', kan); kstem = re.sub(r'[ぁ-ん]+$', '', kata)
    shown = ctx.replace(stem, kstem, 1) if stem in ctx else ctx
    acc = [kan] + ([stem] if stem != kan else [])
    out.append(dict(id=kid, cat="漢字", rank="A" if rank=="S" else rank, diff=2, type="extract", q=f"「{kata}」を漢字に直しなさい。",
        ctx=shown, model=kan, accept=acc, expl=f"{kata}→{kan}", page=page, scene="本文：「" + shown + "」",
        reason="過去問では各大問の問1でカタカナを漢字に直す問題を出題", ch=[], rel=[], word=kata, keys=[]))
# ---- 読解 ----
for q in Q:
    q = dict(q)
    out.append(q)

# ---- MC 選択肢の配置 ----
for q in out:
    if q["type"] == "mc":
        n = len(q["wrongs"]) + 1
        p = pos(q["id"], n)
        ch = [w[0] for w in q["wrongs"]]; why = [w[1] for w in q["wrongs"]]
        ch.insert(p, q["ok"]); why.insert(p, "正解")
        q["choices"] = ch; q["why"] = why; q["answer"] = p
        q["model"] = q.get("model") or q["ok"]
        del q["wrongs"]; del q["ok"]

# ---- 検証 ----
ids = [q["id"] for q in out]
errs = []
dup = {i for i in ids if ids.count(i) > 1}
if dup: errs.append(f"重複ID {dup}")
idset = set(ids)
pmap = {p["id"]: p for p in PASSAGES}
for q in out:
    for r in q.get("rel", []):
        if r not in idset: errs.append(f"{q['id']} 関連ID {r} なし")
    if q.get("p"):
        if q["p"] not in pmap: errs.append(f"{q['id']} 本文 {q['p']} なし")
        elif q.get("u") and "{" + q["u"] + "|" not in pmap[q["p"]]["text"]: errs.append(f"{q['id']} 傍線 {q['u']} が {q['p']} にない")
    if q["type"] == "mc":
        if len(q["choices"]) != 4 or len(set(q["choices"])) != 4: errs.append(f"{q['id']} 選択肢数/重複")
    if q["type"] == "extract" and not q.get("accept"): errs.append(f"{q['id']} accept なし")
    if q["type"] in ("short", "write") and not q.get("keys") and q["id"] != "W13": errs.append(f"{q['id']} keys なし")
    if q["rank"] not in "SAB": errs.append(f"{q['id']} rank")
    for k in ("q", "model", "expl", "page", "reason"):
        if not q.get(k): errs.append(f"{q['id']} {k} 空")
    # 抜き出し: 正答が本文引用に含まれるか（引用がある場合）
    if q["type"] == "extract" and q.get("p") and q["cat"] != "漢字":
        txt = re.sub(r'\{[^|]+\|', '', pmap[q["p"]]["text"]).replace('}', '')
        a = q["accept"][0].strip("「」")
        if a.rstrip("。") not in txt: errs.append(f"{q['id']} 抜き出し正答が引用本文に見当たらない: {a}")
for p in PASSAGES:
    labs = re.findall(r'\{([^|]+)\|', p["text"])
    if len(labs) != len(set(labs)): errs.append(f"{p['id']} 傍線ラベル重複")
# 漢字・語句の文脈チェック（本文転記 fulltext.txt と照合）
import os
full = open('fulltext.txt').read().replace('\n', '') if os.path.exists('fulltext.txt') else None
for q in (out if full else []):
    if q["cat"] == "語句" or (q["cat"] == "漢字" and q["id"].startswith("J")):
        c = q["ctx"].strip("「」")
        if c not in full: errs.append(f"{q['id']} 文脈が本文と不一致: {c}")
for q in out:
    if q["cat"] == "漢字" and q["id"].startswith("K"):
        orig = q["ctx"]
for (kid, kata, kan, page, ctx, rank) in (KAKI if full else []):
    if ctx not in full: errs.append(f"{kid} 文脈が本文と不一致: {ctx}")
for p in (PASSAGES if full else []):
    for seg in re.split(r'（中略）|（後略）|\n', re.sub(r'\{[^|]+\|', '', p["text"]).replace('}', '')):
        seg = seg.strip()
        if seg and seg not in full: errs.append(f"{p['id']} 引用が本文と不一致: {seg[:30]}…")

# ---- 模擬試験 ----
def pts(q):
    t = q["type"]
    if q["cat"] == "漢字": return 1
    if q["cat"] == "語句": return 2
    if q["cat"] == "原稿用紙": return 2
    if t == "mc" or t == "extract": return 3
    if t == "short": return 4
    lim = q.get("limit") or ""
    m = re.findall(r'(\d+)', lim.translate(str.maketrans("０１２３４５６７８９", "0123456789")))
    n = max(int(x) for x in m) if m else 40
    return 5 if n <= 30 else 6 if n <= 40 else 8 if n <= 60 else 10
EXAMS = [
 dict(id="M1", title="第1回 模擬試験（最重要問題中心）", time=50, sections=[
   dict(name="一", title="カズオ・タケシの場面（252〜253ページ）",
        kanji=["J01","J03","J05","J09","J10","J14","K01","K02","K03","K04"], vocab=["V02","V10","V17","V18"],
        items=["F06","F03","R01","X05","E02","F13","F14"]),
   dict(name="二", title="ヒナコ・サユリの場面と結び（253〜257ページ）",
        kanji=["J17","J18","J19","J22","J26","J29","K07","K10","K12","K15"], vocab=["V21","V32","V40","V46"],
        items=["F16","R13","E10","F20","F27","E15","F33","R21","N05","W04"]),
   dict(name="三", title="原稿用紙の使い方", kanji=[], vocab=[], items=["G01","G02","G04"]),
 ]),
 dict(id="M2", title="第2回 模擬試験（標準・応用混合）", time=50, sections=[
   dict(name="一", title="カズオ・タケシの場面（252〜253ページ）",
        kanji=["J02","J04","J06","J07","J08","J11","J12","J13","K05","K03"], vocab=["V04","V07","V11","V13"],
        items=["F02","F04","F08","F10","R08","X01","E07","W14"]),
   dict(name="二", title="ヒナコ・サユリの場面と結び（253〜257ページ）",
        kanji=["J23","J24","J25","J30","J31","J32","K06","K13","K16","K20"], vocab=["V24","V36","V42","V47"],
        items=["F18","F19","R16","F24","F30","F32","X17","E14","E21","N06"]),
   dict(name="三", title="原稿用紙の使い方", kanji=[], vocab=[], items=["G03","G05","G06"]),
 ]),
 dict(id="M3", title="第3回 模擬試験（本番直前総仕上げ）", time=50, sections=[
   dict(name="一", title="カズオ・タケシの場面（252〜253ページ）",
        kanji=["J01","J03","J09","J10","J14","J05","K01","K02","K04","K03"], vocab=["V01","V09","V15","V16"],
        items=["F05","F11","R05","R06","N01","W01"]),
   dict(name="二", title="ヒナコ・サユリの場面と結び（253〜257ページ）",
        kanji=["J18","J21","J26","J29","J33","J35","K08","K09","K11","K19"], vocab=["V27","V30","V55","V58"],
        items=["F22","F28","F38","R23","X13","N15","W08","W09"]),
   dict(name="三", title="原稿用紙の使い方", kanji=[], vocab=[], items=["G02","G04","G01"]),
 ]),
]
qmap = {q["id"]: q for q in out}
for ex in EXAMS:
    tot = 0
    for s in ex["sections"]:
        s["points"] = {}
        for i in s["kanji"] + s["vocab"] + s["items"]:
            if i not in qmap: errs.append(f"{ex['id']} {i} なし"); continue
            s["points"][i] = pts(qmap[i]); tot += s["points"][i]
        s["sum"] = sum(s["points"].values())
    ex["total"] = tot
    print(ex["id"], [s["sum"] for s in ex["sections"]], tot)

# ---- 統計 ----
from collections import Counter
print("問題数", len(out))
print("ランク", Counter(q["rank"] for q in out))
print("分野", Counter(q["cat"] for q in out))
print("形式", Counter(q["type"] for q in out))
print("本文引用つき", sum(1 for q in out if q.get("p")))
if errs:
    print("ERRORS", len(errs)); print("\n".join(errs))
data = dict(questions=out, passages=PASSAGES, exams=EXAMS, examDate="2026-10-20",
            built="2026-10-18")
open('data.json', 'w').write(json.dumps(data, ensure_ascii=False, indent=0))
