import json, hashlib, re, sys
sys.path.insert(0, '.')
from qhelp import Q
import q_read1, q_read2
N_DENSHA = len(Q)
import tk_q
from tk_q import KANJI_TK, YOMI_TK
from tk_vocab import VOCAB_TK
from tk_passages import PASSAGES_TK
from passages import PASSAGES as P_D
for p in P_D: p["subj"] = "densha"; p.setdefault("kobun", False)
for p in PASSAGES_TK: p["subj"] = "taketori"
PASSAGES = P_D + PASSAGES_TK
from q_vocab import VOCAB
from q_kanji import YOMI, KAKI

KANA = "アイウエ"
def pos(i, n=4):
    return int(hashlib.md5(i.encode()).hexdigest(), 16) % n

out = []
# ---- 語句 ----
SHORT_D = {"胸をドキドキさせる":"緊張や興奮で胸が高鳴る","うつむく":"顔を下に向ける","不公平":"平等でない","唇をかみしめる":"悔しさをこらえる","ムッとする":"不快に思う","権利":"認められた資格","危なっかしい":"見ていて危険そう","身勝手":"自分の都合だけ考える","ふんばる":"力を入れて耐える","ためらう":"迷って行動できない","寒け":"寒く感じること","舌打ち":"不満で舌を鳴らす","ぐあい":"状態や調子","胸の高鳴り":"興奮で胸が高鳴る","発揮する":"力を十分に出す","会釈":"軽く頭を下げる","こわばる":"緊張して硬くなる","目をそらす":"視線を外す","どんより":"暗く重苦しい様子","居心地が悪い":"その場にいる気分（が悪い）","乗り合わせる":"同じ乗り物に乗る","身軽":"動きやすい","一致する":"同じになる","常識":"一般的な知識や判断","衝突":"ぶつかる・対立する","手を取り合う":"協力する"}
for (vid, w, page, ctx, mean, wr, trap, rank, diff, ch, keys) in VOCAB:
    if w in SHORT_D: trap = (trap + "。" if trap else "") + "暗記テストの答え：" + SHORT_D[w]
    out.append(dict(id=vid, subj="densha", cat="語句", rank=rank, diff=diff, type="mc",
        q=f"「{w}」の本文中の意味として最も適切なものを選びなさい。",
        ctx=ctx, ok=mean, wrongs=wr, expl=f"本文中の意味：{mean}。" + (f"【注意】{trap}" if trap else ""),
        page=page, scene="本文：「" + ctx + "」", reason="過去問では各大問の問2で「語句の意味」が毎回出題（ア・イ・ウの3択）。本文に出てくる語句", ch=ch, rel=[vid+"s"] if keys else [], word=w, model=mean))
    if keys:
        out.append(dict(id=vid+"s", subj="densha", cat="語句", rank="A" if rank=="S" else rank, diff=min(3, diff+1), type="short",
            q=f"「{w}」の本文中の意味を、十〜二十五字程度で答えなさい。", ctx=ctx, model=mean, keys=keys,
            expl=f"意味が合っていれば正解。キーワード：{'・'.join(k[0].split('|')[0] for k in keys)}。" + (f"【注意】{trap}" if trap else ""),
            page=page, scene="本文：「" + ctx + "」", reason="意味を自分の言葉で答える練習（記述型の語句問題への備え）", ch=ch, rel=[vid], word=w, accept=[]))
# ---- 漢字 ----
for (jid, w, yomi, page, ctx, rank) in YOMI:
    out.append(dict(id=jid, subj="densha", cat="漢字", rank="A" if rank=="S" else rank, diff=1, type="extract", q=f"「{w}」の読みをひらがなで書きなさい。",
        ctx=ctx, model=yomi, accept=[yomi], expl=f"{w}（{yomi}）。教科書ではふりがなつきの語。", page=page,
        scene="本文：「" + ctx + "」", reason="過去問では各大問の問1で漢字（読み・書き）を10問出題", ch=[], rel=[], word=w, keys=[]))
for (kid, kata, kan, page, ctx, rank) in KAKI:
    stem = re.sub(r'[ぁ-ん]+$', '', kan); kstem = re.sub(r'[ぁ-ん]+$', '', kata)
    shown = ctx.replace(stem, kstem, 1) if stem in ctx else ctx
    acc = [kan] + ([stem] if stem != kan else [])
    out.append(dict(id=kid, subj="densha", cat="漢字", rank="A" if rank=="S" else rank, diff=2, type="extract", q=f"「{kata}」を漢字に直しなさい。",
        ctx=shown, model=kan, accept=acc, expl=f"{kata}→{kan}", page=page, scene="本文：「" + shown + "」",
        reason="過去問では各大問の問1でカタカナを漢字に直す問題を出題", ch=[], rel=[], word=kata, keys=[]))
# ---- 読解 ----
for i, q in enumerate(Q):
    q = dict(q); q["subj"] = "densha" if i < N_DENSHA else "taketori"
    out.append(q)
# ---- 竹取：語句・漢字 ----
TKREASON = "資料「短い意味暗記テスト」の37語。過去問では各大問の問2で語句の意味が毎回出題"
for (vid, w, page, ctx, mean, extra, wr, rank, ch, keys) in VOCAB_TK:
    note = (f"【補足】{extra}" if extra else "")
    out.append(dict(id=vid, subj="taketori", cat="語句", rank=rank, diff=1, type="mc", q=f"「{w}」の本文中の意味として最も適切なものを選びなさい。",
        ctx=ctx, ok=mean, wrongs=wr, expl=f"意味：{mean}（暗記テストの答え）。" + note, page=page, scene="本文：「" + ctx + "」", reason=TKREASON, ch=ch, rel=[vid + "s"], word=w, model=mean, vocab37=True))
    out.append(dict(id=vid + "s", subj="taketori", cat="語句", rank="A" if rank == "S" else rank, diff=2, type="short", q=f"「{w}」の意味を短く答えなさい。",
        ctx=ctx, model=mean, keys=keys, expl=f"暗記テストの答え：{mean}。意味が合っていれば正解。" + note, page=page, scene="本文：「" + ctx + "」",
        reason="意味を自分の言葉で答える練習（暗記テスト形式）", ch=ch, rel=[vid], word=w, accept=[], vocab37=True))
for (kid, kata, kan, acc, page, shown, orig) in KANJI_TK:
    out.append(dict(id=kid, subj="taketori", cat="漢字", rank="S", diff=2, type="extract", q=f"「{kata}」を漢字に直しなさい。",
        ctx=shown, orig=orig, model=kan, accept=acc, expl=f"{kata} → {kan}。教科書131ページの新出漢字。", page=page, scene="本文：「" + shown + "」",
        reason="資料「漢字書き取り11問」。過去問では各大問の問1で漢字を10問出題", ch=[], rel=[], word=kata, keys=[], kanji11=True))
for (jid, w, yomi, page, ctx, rank) in YOMI_TK:
    out.append(dict(id=jid, subj="taketori", cat="漢字", rank=rank, diff=1, type="extract", q=f"「{w}」の読みをひらがなで書きなさい。",
        ctx=ctx, model=yomi, accept=[yomi], expl=f"{w}（{yomi}）。", page=page, scene="本文：「" + ctx + "」",
        reason="過去問では各大問の問1で漢字の読みを出題", ch=[], rel=[], word=w, keys=[]))

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
    if q["cat"] == "仮名遣い":
        w = q["q"].split("「")[1].split("」")[0]
        if w not in q["scene"]: errs.append(f"{q['id']} 仮名遣いの語が本文にない {w}")
        if q.get("p") and w not in pmap[q["p"]]["text"].replace("{", "").replace("}", "") and w not in re.sub(r'\{[^|]+\|', '', pmap[q["p"]]["text"]): errs.append(f"{q['id']} 仮名遣いの語が傍線本文にない {w}")
    if q["type"] == "extract" and q.get("p") and q["cat"] not in ("漢字", "仮名遣い"):
        txt = re.sub(r'\{[^|]+\|', '', pmap[q["p"]]["text"]).replace('}', '')
        a = q["accept"][0].strip("「」")
        if a.rstrip("。") not in txt: errs.append(f"{q['id']} 抜き出し正答が引用本文に見当たらない: {a}")
for p in PASSAGES:
    labs = re.findall(r'\{([^|]+)\|', p["text"])
    if len(labs) != len(set(labs)): errs.append(f"{p['id']} 傍線ラベル重複")
# 漢字・語句の文脈チェック（本文転記 fulltext*.txt と照合）
import os
FULL = {}
for sj, fn in (("densha", "fulltext.txt"), ("taketori", "fulltext_tk.txt")):
    if os.path.exists(fn): FULL[sj] = open(fn).read().replace("\n", "")
checked = 0
for q in out:
    full = FULL.get(q["subj"])
    if not full: continue
    if q["cat"] == "語句" or (q["cat"] == "漢字" and q["id"][:2] in ("J0", "J1", "J2", "J3", "TJ")) or q["cat"] == "仮名遣い":
        c = q["ctx"].strip("「」") if q.get("ctx") else q["scene"].replace("本文：「", "").rstrip("」")
        checked += 1
        if c not in full: errs.append(f"{q['id']} 文脈が本文と不一致: {c}")
    if q.get("orig"):
        checked += 1
        if q["orig"] not in full: errs.append(f"{q['id']} 文脈が本文と不一致: {q['orig']}")
for (kid, kata, kan, page, ctx, rank) in (KAKI if "densha" in FULL else []):
    checked += 1
    if ctx not in FULL["densha"]: errs.append(f"{kid} 文脈が本文と不一致: {ctx}")
for p in PASSAGES:
    full = FULL.get(p["subj"])
    if not full: continue
    for seg in re.split(r'（中略）|（後略）|\n', re.sub(r'\{[^|]+\|', '', p["text"]).replace('}', '')):
        seg = seg.strip(); checked += 1
        if seg and seg not in full: errs.append(f"{p['id']} 引用が本文と不一致: {seg[:30]}…")
print("本文照合した引用・文脈", checked)
# 11問・37語の完全収録
K11 = ["筒","嘆き悲しんで","遣わした","髪","錠を下ろして","伴って","託した","献上","お尋ねになる","吐き出される","煙"]
got = [q["model"] for q in out if q.get("kanji11")]
if got != K11: errs.append(f"漢字11問が資料と一致しない {got}")
W37 = ["翁","媼","一寸","都","貴公子","策略","秀でる","持参","拒む","偽り","帝","宮中","応じる","やむなく","（心が）通う","もの思い","ふける","使者","遣わす","ただれる","派遣","血気盛ん","錠（を下ろす）","物の怪","気丈","見当違い","うつろ","伴う","格子","形見","羽衣","心持ち","託す","傍ら","病床","献上","仕える"]
gw = [q["word"] for q in out if q.get("vocab37") and q["type"] == "mc"]
if gw != W37: errs.append(f"語句37語が資料と一致しない {set(W37) ^ set(gw)}")
# ---- 模擬試験 ----
def pts(q):
    t = q["type"]
    if q["cat"] == "漢字": return 1
    if q["cat"] == "語句": return 2
    if q["cat"] in ("原稿用紙", "仮名遣い"): return 2
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
for e in EXAMS: e["subj"] = "densha"
EXAMS += [
 dict(id="TM1", subj="taketori", title="竹取物語 第1回（最重要問題中心）", time=50, sections=[
   dict(name="一", title="かぐや姫の誕生から帝との手紙まで（119〜122ページ）",
        kanji=["TK01","TK02","TK03","TK04","TJ12","TJ13","TJ14","TJ15","TJ16","TJ17"], vocab=["TV05","TV09","TV10","TV14"],
        items=["TH01","TH06","TG05","TG06","TF04","TF06","TE07","TF10","TF14","TW01"]),
   dict(name="二", title="八月十五日から結末まで（122〜127ページ）",
        kanji=["TK05","TK06","TK07","TK08","TK09","TK10","TK11","TJ21","TJ23","TJ24"], vocab=["TV22","TV24","TV30","TV33"],
        items=["TH13","TH14","TH16","TG16","TF19","TF23","TF24","TS02","TE15","TF27","TW03"]),
 ]),
 dict(id="TM2", subj="taketori", title="竹取物語 第2回（標準・応用混合）", time=50, sections=[
   dict(name="一", title="かぐや姫の誕生から帝との手紙まで（119〜122ページ）",
        kanji=["TK01","TK02","TK03","TK04","TJ01","TJ02","TJ03","TJ04","TJ30","TJ28"], vocab=["TV01","TV06","TV13","TV16"],
        items=["TH02","TH04","TG02","TF01","TF05","TF08","TE04","TF09","TF12","TW09"]),
   dict(name="二", title="八月十五日から結末まで（122〜127ページ）",
        kanji=["TK05","TK06","TK07","TK08","TK09","TK10","TK11","TJ05","TJ06","TJ07"], vocab=["TV21","TV27","TV31","TV36"],
        items=["TH08","TH10","TG11","TG14","TF18","TF21","TF26","TS04","TE13","TO14","TW05"]),
 ]),
 dict(id="TM3", subj="taketori", title="竹取物語 第3回（本番直前総仕上げ）", time=50, sections=[
   dict(name="一", title="かぐや姫の誕生から帝との手紙まで（119〜122ページ）",
        kanji=["TK01","TK02","TK03","TK04","TJ12","TJ13","TJ14","TJ19","TJ20","TJ22"], vocab=["TV03","TV11","TV15","TV17"],
        items=["TH03","TH05","TG03","TG04","TO04","TF03","TF13","TF15","TE08","TW07"]),
   dict(name="二", title="八月十五日から結末まで（122〜127ページ）",
        kanji=["TK05","TK06","TK07","TK08","TK09","TK10","TK11","TJ25","TJ26","TJ27"], vocab=["TV25","TV28","TV32","TV37"],
        items=["TH11","TG22","TG17","TG20","TF20","TF25","TF28","TO09","TE12","TW02"]),
 ]),
 dict(id="X1", subj="mix", title="国語中間テスト総合模試 第1回", time=50, sections=[
   dict(name="一", title="電車は走る（252〜257ページ）",
        kanji=["J01","J03","J09","J17","K03","K04","K07","K12"], vocab=["V17","V21","V40"],
        items=["F06","F13","F24","X21","E10","F33","E02","R21","W01"]),
   dict(name="二", title="竹取物語（118〜131ページ）",
        kanji=["TK01","TK03","TK05","TK07","TK08","TK10","TK11"], vocab=["TV09","TV14","TV30"],
        items=["TH01","TH07","TG06","TF04","TF14","TE07","TF24","TF27","TE13","TE15","TW03"]),
   dict(name="三", title="原稿用紙の使い方", kanji=[], vocab=[], items=["G01","G02","G04"]),
 ]),
 dict(id="X2", subj="mix", title="国語中間テスト総合模試 第2回", time=50, sections=[
   dict(name="一", title="電車は走る（252〜257ページ）",
        kanji=["J18","J22","J26","J29","K10","K15","K20","K02"], vocab=["V32","V46","V55"],
        items=["F03","F14","R13","F20","F27","E15","N05","X13","W03"]),
   dict(name="二", title="竹取物語（118〜131ページ）",
        kanji=["TK02","TK04","TK06","TK09","TJ13","TJ14","TJ23","TJ24"], vocab=["TV10","TV22","TV33"],
        items=["TH13","TH16","TG16","TF10","TF19","TF23","TF26","TE07","TE12","TG20","TW05"]),
   dict(name="三", title="原稿用紙の使い方", kanji=[], vocab=[], items=["G01","G03"]),
 ]),
 dict(id="X3", subj="mix", title="国語中間テスト総合模試 第3回", time=50, sections=[
   dict(name="一", title="電車は走る（252〜257ページ）",
        kanji=["J05","J10","J14","J32","K01","K11","K13","K19"], vocab=["V10","V18","V58"],
        items=["F16","F27","F30","E14","X18","F38","R10","N01","W09"]),
   dict(name="二", title="竹取物語（118〜131ページ）",
        kanji=["TK01","TK05","TK08","TK10","TK11","TJ05"], vocab=["TV24","TV27","TV37"],
        items=["TH10","TH14","TG20","TF14","TF23","TF27","TO04","TO14","TE13","TE15","TW02"]),
   dict(name="三", title="原稿用紙の使い方", kanji=[], vocab=[], items=["G05","G06"]),
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
print("分野", Counter((q["subj"], q["cat"]) for q in out))
print("教材別", Counter(q["subj"] for q in out), Counter((q["subj"], q["rank"]) for q in out))
print("形式", Counter(q["type"] for q in out))
print("本文引用つき", sum(1 for q in out if q.get("p")))
if errs:
    print("ERRORS", len(errs)); print("\n".join(errs))
data = dict(questions=out, passages=PASSAGES, exams=EXAMS, examDate="2026-10-20",
            built="2026-10-18")
open('data.json', 'w').write(json.dumps(data, ensure_ascii=False, indent=0))
