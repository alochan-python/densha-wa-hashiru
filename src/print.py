import json, re, os, html
from playwright.sync_api import sync_playwright
B = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(B, "..", "docs", "pdf"); os.makedirs(OUT, exist_ok=True)
D = json.load(open(os.path.join(B, "data.json")))
QM = {q["id"]: q for q in D["questions"]}; PM = {p["id"]: p for p in D["passages"]}
PORDER = [p["id"] for p in D["passages"]]
KANA = "アイウエ"; ROMAN = "ⅰⅱⅲⅳ"; AL = "ABCDEFGHIJKLMNOP"; ABC = "abcdefghij"
e = html.escape
CSS = """
@page{size:A4;margin:14mm 13mm}
body{font-family:"Noto Serif CJK JP","Noto Serif CJK SC",serif;font-size:10.5pt;line-height:1.75;color:#000}
.g{font-family:"Noto Sans CJK JP","Noto Sans CJK SC",sans-serif}
h1{font-size:15pt;margin:0 0 2mm;display:flex;justify-content:space-between;border-bottom:1.5pt solid #000;padding-bottom:1mm}
h2{font-size:12pt;margin:5mm 0 2mm;break-after:avoid}
h2 .no{border:1.2pt solid #000;padding:0 2mm;margin-right:2mm}
.meta{font-size:9pt;margin-bottom:3mm}
.hb{border:0.8pt solid #000;padding:3mm 4mm;margin:2mm 0;white-space:pre-wrap;line-height:2;break-inside:avoid}
.hb .src{display:block;font-size:8pt;color:#333;white-space:normal}
u{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1pt}
u b{font-family:"Noto Sans CJK JP",sans-serif;font-size:8.5pt}
.q{margin:2.2mm 0;break-inside:avoid}
.q .n{font-weight:bold;font-family:"Noto Sans CJK JP",sans-serif}
.pt{float:right;font-size:8.5pt}
.ch{margin-left:6mm}
.kg{display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;margin:1mm 0 0 6mm}
table{border-collapse:collapse;width:100%}
td,th{border:0.8pt solid #000;padding:1.5mm 2mm;vertical-align:top;text-align:left}
th{background:#eee;font-family:"Noto Sans CJK JP",sans-serif;font-size:9pt;white-space:nowrap;width:16mm}
.box{height:9mm}
.gen{display:grid;grid-auto-flow:column;grid-template-rows:repeat(10,6.2mm);direction:rtl;justify-content:start}
.gen span{width:6.2mm;height:6.2mm;border:0.5pt solid #555;margin:-0.25pt}
.ans{color:#b00012;font-weight:bold}
.ex{font-size:9pt;color:#222}
.small{font-size:8.5pt}
.brk{break-before:page}
"""
def passage(pid, relabel):
    p = PM[pid]; out = ""
    for m in re.split(r"(\{[^|}]+\|[^}]*\})", p["text"]):
        mm = re.match(r"\{([^|}]+)\|([^}]*)\}", m)
        if mm:
            k = pid + "-" + mm.group(1)
            out += f"<u><b>{relabel[k]}</b>{e(mm.group(2))}</u>" if k in relabel else e(mm.group(2))
        else: out += e(m)
    return f'<div class="hb">{out}<span class="src g">（重松清「電車は走る」教科書 p.{e(p["page"])}{"・" + e(p["lines"]) if p["lines"] else ""}より一部引用）</span></div>'
def layout(s):
    rel, li, ps = {}, 0, []
    for i in s["items"]:
        q = QM[i]
        if q.get("p") and q["p"] not in ps: ps.append(q["p"])
        if q.get("p") and q.get("u"):
            k = q["p"] + "-" + q["u"]
            if k not in rel: rel[k] = "(" + AL[li] + ")"; li += 1
    ps.sort(key=PORDER.index); return rel, ps
def qtext(q, rel):
    t = q["q"]
    if q.get("u"): t = t.replace("傍線" + q["u"], "傍線部" + rel[q["p"] + "-" + q["u"]])
    return t
def hl(ctx, word):
    stem = re.sub(r"[ぁ-ん]+$", "", word); c = e(ctx)
    return c.replace(e(stem), f"<u>{e(stem)}</u>", 1)
def numbering(s):
    n = 1; L = []
    if s["kanji"]: L.append(("kanji", n)); n += 1
    if s["vocab"]: L.append(("vocab", n)); n += 1
    for i in s["items"]: L.append((i, n)); n += 1
    return dict(L)
def answer_of(q):
    if q["type"] == "mc": return KANA[q["answer"]] + "　" + q["choices"][q["answer"]]
    return q["model"]
def genko(n):
    return '<div class="gen">' + "<span></span>" * (((n + 9) // 10) * 10) + "</div>"
def paper(ex, kind):
    h = f'<h1><span>{e(ex["title"])}</span><span class="g small">{["問題用紙","解答用紙","模範解答・解説"][kind]}</span></h1>'
    h += f'<div class="meta g">中学1年 国語　「電車は走る」（重松清）　制限時間 {ex["time"]}分（推定）　100点　　組（　　）番（　　）名前（　　　　　　　　　）</div>'
    if kind == 0: h += '<div class="small g">＊答えは丁寧に、解答欄に収まるように書くこと。　＊数字や記号は、すべて一字とします。　＊配点・制限時間は過去問をもとにした推定です。</div>'
    for s in ex["sections"]:
        rel, ps = layout(s); num = numbering(s)
        h += f'<h2><span class="no">{s["name"]}</span>{e(s["title"])}<span class="pt g">（{s["sum"]}点）</span></h2>'
        if kind == 0:
            for pid in ps: h += passage(pid, rel)
            if s["kanji"]:
                h += f'<div class="q"><span class="n">問{num["kanji"]}</span>　a〜{ABC[len(s["kanji"])-1]}の傍線部について、漢字は読みをひらがなで、カタカナは漢字に直しなさい。<span class="pt g">各1点</span><div class="kg">'
                h += "".join(f'<div>{ABC[i]}　{hl(QM[k]["ctx"], QM[k]["word"])}</div>' for i, k in enumerate(s["kanji"])) + "</div></div>"
            if s["vocab"]:
                h += f'<div class="q"><span class="n">問{num["vocab"]}</span>　（ⅰ）〜（{ROMAN[len(s["vocab"])-1]}）の語句の本文中の意味として最も適切なものを選び、記号で答えなさい。<span class="pt g">各2点</span>'
                for i, k in enumerate(s["vocab"]):
                    q = QM[k]
                    h += f'<div class="ch"><b>（{ROMAN[i]}）{e(q["word"])}</b>　<span class="small">本文「{e(q["ctx"])}」</span><br>' + "<br>".join(f'{KANA[j]}　{e(c)}' for j, c in enumerate(q["choices"])) + "</div>"
                h += "</div>"
            for i in s["items"]:
                q = QM[i]
                h += f'<div class="q"><span class="n">問{num[i]}</span>　{e(qtext(q, rel))}<span class="pt g">{s["points"][i]}点</span>'
                if q["type"] == "mc": h += "".join(f'<div class="ch">{KANA[j]}　{e(c)}</div>' for j, c in enumerate(q["choices"]))
                h += "</div>"
        elif kind == 1:
            rows = ""
            if s["kanji"]:
                cells = "".join(f'<td class="box"><span class="small">{ABC[j]}</span></td>' + ("</tr><tr>" if j == 4 else "") for j in range(len(s["kanji"])))
                rows += f'<tr><th>問{num["kanji"]}</th><td style="padding:0"><table><tr>{cells}</tr></table></td></tr>'
            if s["vocab"]:
                rows += f'<tr><th>問{num["vocab"]}</th><td><table><tr>' + "".join(f'<td class="box"><span class="small">（{ROMAN[j]}）</span></td>' for j in range(len(s["vocab"]))) + "</tr></table></td></tr>"
            for i in s["items"]:
                q = QM[i]
                lim = q.get("limit") or ""
                mx = re.findall(r"\d+", lim)
                if q["type"] == "write" and mx: cell = genko(max(map(int, mx))) + f'<span class="small">{e(lim)}</span>'
                elif q["type"] in ("short", "write"): cell = '<div style="height:16mm"></div>'
                elif q["type"] == "extract": cell = '<div style="height:9mm"></div>'
                else: cell = '<div style="height:7mm"></div>'
                rows += f'<tr><th>問{num[i]}</th><td>{cell}</td></tr>'
            h += f"<table>{rows}</table>"
        else:
            if s["kanji"]:
                h += f'<div class="q"><span class="n">問{num["kanji"]}</span>　' + "　".join(f'{ABC[j]} <span class="ans">{e(QM[k]["model"])}</span>' for j, k in enumerate(s["kanji"])) + "</div>"
            if s["vocab"]:
                h += f'<div class="q"><span class="n">問{num["vocab"]}</span>　' + "　".join(f'（{ROMAN[j]}）<span class="ans">{KANA[QM[k]["answer"]]}</span>' for j, k in enumerate(s["vocab"])) + "</div>"
            for i in s["items"]:
                q = QM[i]
                h += f'<div class="q"><span class="n">問{num[i]}</span>　<span class="ans">{e(answer_of(q))}</span><span class="pt g">{s["points"][i]}点・{q["rank"]}ランク・{i}</span>'
                h += f'<div class="ex">【解説】{e(q["expl"])}　（教科書 p.{e(q["page"])}）</div>'
                if q["type"] == "mc": h += '<div class="ex">' + "　".join(f'{KANA[j]}：{e(w)}' for j, w in enumerate(q["why"]) if w != "正解") + "</div>"
                if q["type"] in ("short", "write"): h += '<div class="ex">【部分点の目安】キーワードがすべて入っていれば満点、半分以上で半分の点。字数制限を守っていない場合は減点。</div>'
                h += "</div>"
    return h
def doc(body, title):
    return f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>{e(title)}</title><style>{CSS}</style></head><body>{body}</body></html>'
def lists():
    S = [q for q in D["questions"] if q["rank"] == "S" and q["cat"] not in ("語句", "漢字")]
    h = '<h1><span>Sランク最重要問題一覧</span><span class="g small">電車は走る</span></h1><table><tr><th>ID</th><th style="width:auto">問題</th><th style="width:auto">答え</th><th>p.</th></tr>'
    for q in S: h += f'<tr><td class="small">{q["id"]}</td><td class="small">{e(q["q"])}</td><td class="small ans">{e(answer_of(q))}</td><td class="small">{e(q["page"])}</td></tr>'
    h += "</table>"
    h += '<h1 class="brk"><span>語句の意味一覧</span><span class="g small">電車は走る</span></h1><table><tr><th>語句</th><th style="width:auto">本文中の意味</th><th style="width:auto">注意</th><th>p.</th></tr>'
    for q in D["questions"]:
        if q["cat"] == "語句" and q["type"] == "mc":
            h += f'<tr><td><b>{e(q["word"])}</b><br><span class="small">{q["rank"]}</span></td><td>{e(q["model"])}</td><td class="small">{e(q["expl"].split("【注意】")[1] if "【注意】" in q["expl"] else "")}</td><td class="small">{e(q["page"])}</td></tr>'
    h += "</table>"
    h += '<h1 class="brk"><span>漢字一覧</span><span class="g small">電車は走る</span></h1><table><tr><th>問題</th><th style="width:auto">答え</th><th style="width:auto">本文</th><th>p.</th></tr>'
    for q in D["questions"]:
        if q["cat"] == "漢字": h += f'<tr><td>{e(q["word"])}</td><td class="ans">{e(q["model"])}</td><td class="small">{e(q["ctx"])}</td><td class="small">{e(q["page"])}</td></tr>'
    return doc(h + "</table>", "一覧")
files = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for ex in D["exams"]:
        for k, nm in enumerate(["問題用紙", "解答用紙", "模範解答"]):
            fn = f'{OUT}/模擬試験{ex["id"][1]}_{k+1}{nm}.pdf'
            pg.set_content(doc(paper(ex, k), ex["title"] + nm)); pg.pdf(path=fn, format="A4", print_background=True); files.append(fn)
    fn = f"{OUT}/一覧_Sランク・語句・漢字.pdf"; pg.set_content(lists()); pg.pdf(path=fn, format="A4", print_background=True); files.append(fn)
    b.close()
for f in files: print(os.path.basename(f), os.path.getsize(f) // 1024, "KB")

# ---- 報告書 ----
from collections import Counter
qs = D["questions"]
cats = ["語句","漢字","心情","理由","視点","表現","抜き出し","記述","原稿用紙"]
cc = Counter(q["cat"] for q in qs); rc = Counter(q["rank"] for q in qs)
_e = os.path.join(B, "..", "tests", "shots", "e2e.json"); e2e = json.load(open(_e)) if os.path.exists(_e) else []
_u = os.path.join(B, "..", "tests", "shots", "unit.txt"); unit = open(_u).read().strip() if os.path.exists(_u) else "未実行"
rows = "".join(f"<tr><td>{c}</td><td>{cc[c]}</td><td>{sum(1 for q in qs if q['cat']==c and q['rank']=='S')}</td><td>{sum(1 for q in qs if q['cat']==c and q['rank']=='A')}</td><td>{sum(1 for q in qs if q['cat']==c and q['rank']=='B')}</td></tr>" for c in cats)
e2erows = "".join(f"<tr><td>{e(n)}</td><td>{'成功' if ok else '失敗'}</td></tr>" for n, ok in e2e)
rep = f"""<h1><span>「電車は走る」テスト対策 報告書</span><span class="g small">2026年10月18日</span></h1>
<h2>1. 作成したもの</h2>
<p>学習アプリ（スマホ・PC対応、8モード、記録・復習機能つき）／予想問題 {len(qs)}問／模擬試験3回分（各100点）と印刷用PDF（問題用紙・解答用紙・模範解答）／Sランク・語句・漢字一覧PDF／この報告書。</p>
<h2>2. 問題数</h2>
<table><tr><th>分野</th><th>問題数</th><th>S</th><th>A</th><th>B</th></tr>{rows}<tr><td><b>合計</b></td><td><b>{len(qs)}</b></td><td>{rc['S']}</td><td>{rc['A']}</td><td>{rc['B']}</td></tr></table>
<p class="small">依頼の目標（語句50・心情40・理由30・視点20・指示語表現20・抜き出し20・記述20）に対し、理由は28問（本文に根拠がある設問だけに絞り、2問は抜き出しに移動）。語句は4択60＋短答19、漢字57・原稿用紙6を追加（過去問の問1・大問三に対応）。</p>
<h2>3. 本文照合</h2>
<p>教科書252〜257ページを画像から全文読み取り、問題作成用に転記しました（判読できない箇所はありませんでした）。傍線用の本文引用15か所・語句と漢字の文脈 136か所は、転記した本文と一字一句一致することをプログラムで確認済み（不一致0）。抜き出し問題の正答が引用本文に含まれること、記述・短答の模範解答が自分の採点キーワードを満たし字数制限内であることも全問自動チェックしました。全{len(qs)}問を本文の場面と照合し、ページを記載しています。p.252は題名のページで、ページ番号が写真に写っていないため、学びの道しるべ（「253ページ・上9行め」）から逆算しました。</p>
<p class="small">注意：おばさんの表情が変わった理由など、本文にはっきり書かれていない部分を考える問題（推論問題）には、アプリ内で「※推し量る問題」と表示しています。</p>
<h2>4. 過去問の出題傾向（一学期期末 2026.7.7）</h2>
<ul>
<li>大問一（説明文「1000円の価値を考える」）・大問二（随筆「字のない葉書」）とも、問1 漢字10問（読み・書き混合）、問2 語句の意味（ⅰ〜ⅳ、ア〜ウの3択）。</li>
<li>本文に(A)(B)…の傍線を引き、「気持ちを具体的に表した20字以内の部分の初めと終わり5字」「表現から伝わる気持ち（4択）」「『 』をつけた理由（20字程度）」「指示語の具体的内容」「伝聞表現の抜き出し」「台詞の形で20字以内」「50字以上の心情説明」など。</li>
<li>ひっかけ選択肢は、本文の言葉を使いながら人物・時期・気持ちの向きを入れかえたもの。</li>
<li>大問三：原稿用紙の使い方のまちがい探し。</li>
</ul>
<p class="small">アプリの模擬試験はこの組み立てを再現しています。違い：語句の意味は練習のため4択、漢字は本文中ではなく一覧で出題、配点・時間（50分）は推定。</p>
<h2>5. テスト結果</h2>
<p>単体テスト：{e(unit)}／E2Eテスト（iPhone幅・iPad幅・PC幅、ダークモード、オフライン）：成功 {sum(1 for _, o in e2e if o)}・失敗 {sum(1 for _, o in e2e if not o)}。途中で見つかった失敗（記述模範解答18問の字数オーバー、復習間隔の計算、本文から問題を開いた後の戻り先、短答1問のキーワード）はすべて修正して再テスト済み。</p>
<table><tr><th style="width:auto">E2Eテスト項目</th><th>結果</th></tr>{e2erows}</table>
<h2>6. 使い方</h2>
<ol><li>アプリのリンクを開く（スマホならホーム画面に追加すると便利）。</li><li>おすすめ順：A Sランク集中 → B 語句の意味 → D 傍線部読解 → E 模擬試験 → 試験当日の朝に H 直前30分。</li><li>書く問題は模範解答と見くらべて自分で○×を押す。</li><li>紙で練習するときはPDFの問題用紙・解答用紙を印刷し、模範解答で丸つけ。</li></ol>
<h2>7. まだできていないこと・制限</h2>
<ul><li>記述の採点はキーワードと自己採点の組み合わせで、意味の自動判定はできません（API不使用のため）。</li>
<li>公開リンク版ではオフライン（Service Worker）と印刷ボタンが使えません。オフラインで使うときは同梱フォルダの index.html を使い、印刷は同梱のPDFを使ってください。</li>
<li>学習記録はその端末のブラウザに保存されます。端末を変えるときは「記録」タブのバックアップ・復元を使います。</li>
<li>出題の的中は保証できません。ランクは過去問の形式・本文の重要度にもとづく相対評価です。</li></ul>
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.set_content(doc(rep, "報告書")); pg.pdf(path=f"{OUT}/報告書（出題分析・テスト結果・使い方）.pdf", format="A4", print_background=True); b.close()
print("report ok")
