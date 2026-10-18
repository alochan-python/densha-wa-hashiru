import subprocess, time, sys, os, json
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--directory", ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = "http://localhost:8765/index.html"
res = []
def t(name, cond):
    res.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" if os.path.exists("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") else None)
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "fonts" not in m.text else None)
        pg.goto(URL); pg.wait_for_selector(".tile")
        t("起動・ホーム表示", pg.locator(".tile").count() == 6)
        t("全問題数の表示", "292" in pg.inner_text("main"))
        t("残り日数の表示", "テストまで" in pg.inner_text("#cnt"))
        pg.screenshot(path=f"{SHOT}/01_home.png", full_page=True)
        sw = pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        t("iPhone幅で横スクロールなし（ホーム）", sw)
        # A: Sランク 4択
        pg.click('[data-mode="A"]'); pg.wait_for_selector(".qtext")
        t("Sランクモード開始", "Sランク集中" in pg.inner_text("#ttl"))
        # 4択が出るまでとばす
        for _ in range(40):
            if pg.locator(".choice").count(): break
            pg.click("#skip")
        t("解答前は正解が見えない", pg.locator(".result").count() == 0 and pg.locator(".choice.right").count() == 0)
        t("未選択では解答ボタン無効", pg.is_disabled("#submit"))
        pg.locator(".choice").nth(0).click(); pg.click("#submit")
        t("4択の正誤判定と解説", pg.locator(".choice.right").count() == 1 and "解説" in pg.inner_text("#res"))
        t("選択肢ごとの説明", pg.locator("ul.why li").count() == 4)
        pg.screenshot(path=f"{SHOT}/02_mc.png", full_page=True)
        pg.click("#next"); pg.wait_for_selector(".qtext")
        # 記述（直接開く）
        pg.evaluate("__app.showQ('W01')"); pg.wait_for_selector("textarea")
        t("傍線部つき本文の表示", pg.locator(".bou.on").count() == 1 and "眠ったふり" in pg.inner_text(".bou.on"))
        model = pg.evaluate("APPDATA.questions.find(q=>q.id==='W01').model")
        pg.fill("textarea", model)
        t("字数カウント", "49字" in pg.inner_text("#cc"))
        pg.click("#submit")
        t("記述のキーワード判定", "キーワード 4/4" in pg.inner_text("#res"))
        pg.click('[data-self="1"]')
        rec = pg.evaluate("__app.ST.prog['W01']")
        t("自己採点で記録", rec and rec["c"] == 1)
        pg.screenshot(path=f"{SHOT}/03_write.png", full_page=True)
        # 本文で確認 → 傍線部へ
        pg.click("[data-backto]"); pg.wait_for_selector(".honbun")
        t("問題から本文へ戻る（傍線ハイライト）", pg.locator('.bou.on[data-key="K3-⑤"]').count() == 1)
        # 傍線タップ → 問題一覧 → 問題を開く
        pg.locator('.bou[data-key="K3-④"]').click()
        t("傍線タップで該当傍線を選択", pg.locator('.bou.on[data-key="K3-④"]').count() == 1)
        pg.locator('#u-④ [data-open]').first.click(); pg.wait_for_selector(".qtext")
        t("傍線から関連問題へ移動", "傍線④" in pg.inner_text(".qtext"))
        pg.locator(".choice").nth(0).click(); pg.click("#submit")
        pg.click('[data-go="back"]'); pg.wait_for_selector(".honbun")
        t("問題から元の本文へ戻る", "傍線ごとの問題" in pg.inner_text("main"))
        # 縦書き
        pg.click('[data-act="tate"]')
        t("縦書き切替", pg.locator(".honbun.tate").count() >= 1)
        pg.screenshot(path=f"{SHOT}/04_tate.png", full_page=True)
        pg.click('[data-act="tate"]')
        # 抜き出し
        pg.evaluate("__app.showQ('E02')"); pg.fill("input[type=text]", "「優しくない子供」"); pg.click("#submit")
        t("抜き出しの正誤判定（かぎ付きも正解）", "正解" in pg.inner_text(".mark"))
        # 間違えた問題モード
        pg.evaluate("__app.showQ('E10')"); pg.fill("input[type=text]", "まちがい"); pg.click("#submit")
        pg.click('[data-go="back"]') if pg.locator('[data-go="back"]').count() else None
        pg.evaluate("__app.startMode('F')"); pg.wait_for_selector(".qtext")
        ids = pg.evaluate("__app.SES.queue")
        t("間違えた問題の抽出", "E10" in ids and all(pg.evaluate(f"__app.ST.prog['{i}'].wrong>0") for i in ids))
        # 試験直前30分
        pg.evaluate("__app.startMode('H')")
        t("直前30分モード 30問", pg.evaluate("__app.SES.queue.length") == 30)
        # ランダム（連続で同じ問題なし）
        pg.evaluate("__app.startMode('G')")
        q = pg.evaluate("__app.SES.queue")
        t("ランダム出題・連続重複なし", len(q) == 292 and all(q[i] != q[i + 1] for i in range(len(q) - 1)))
        # 人物別
        pg.evaluate("__app.startMode('CH','ヒナコ')")
        q = pg.evaluate("__app.SES.queue")
        t("人物別（ヒナコ）", len(q) > 20 and all("ヒナコ" in pg.evaluate(f"APPDATA.questions.find(x=>x.id==='{i}').ch") for i in q))
        # 再起動後の復元
        before = pg.evaluate("Object.keys(__app.ST.prog).length")
        pg.reload(); pg.wait_for_selector(".tile")
        after = pg.evaluate("Object.keys(__app.ST.prog).length")
        t(f"再起動後の学習履歴復元（{after}問）", before == after and after >= 4)
        # 模擬試験
        pg.click('[data-go="exam"]'); pg.click('[data-exam="M1"]'); pg.wait_for_selector("#grade")
        t("模擬試験の表示（大問三つ）", pg.locator("h2.dai").count() == 3)
        t("傍線部(A)ラベル", "(A)" in pg.inner_text("main"))
        t("漢字 a〜j", pg.locator(".kj").count() == 20)
        # 全部正解を入力
        data = pg.evaluate("APPDATA.exams[0]")
        for s in data["sections"]:
            for qid in s["points"]:
                qq = pg.evaluate(f"APPDATA.questions.find(x=>x.id==='{qid}')")
                if qq["type"] == "mc": pg.locator(f'[data-mc="{qid}"]').nth(qq["answer"]).click()
                else: pg.fill(f"#ea-{qid}", qq["model"])
        pg.click("#grade")
        sc = int(pg.inner_text("#exres .score"))
        t(f"模擬試験の採点（全問模範解答→{sc}点）", sc == 100)
        pg.locator('[data-sp]').first.click()
        pg.click("#saveex")
        t("模擬試験の最高点を記録", pg.evaluate("__app.ST.best.M1") >= 1)
        pg.screenshot(path=f"{SHOT}/05_exam.png", full_page=False)
        sw = pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        t("iPhone幅で横スクロールなし（模擬試験）", sw)
        # 一覧
        pg.click('[data-go="list"]'); pg.click('[data-list="V"]')
        t("語句の意味一覧", pg.locator("tbody tr").count() == 60)
        # バックアップ・復元・CSV
        pg.click('[data-go="data"]')
        bk = pg.input_value("#bk"); csv = pg.input_value("#csv")
        t("CSVエクスポート", csv.count("\n") >= 292 and "問題ID" in csv)
        pg.click("#rst"); pg.click("#rsty")
        t("記録の消去", pg.evaluate("Object.keys(__app.ST.prog).length") == 0)
        pg.fill("#rs", bk); pg.click("#rsb")
        t("バックアップから復元", "復元しました" in pg.inner_text("#rsm") and pg.evaluate("Object.keys(__app.ST.prog).length") == len(json.loads(bk)["data"]["prog"]))
        pg.click('[data-go="help"]')
        t("使い方・分析ページ", "過去問" in pg.inner_text("main"))
        pg.screenshot(path=f"{SHOT}/06_help.png", full_page=True)
        # PWA / オフライン
        man = pg.evaluate("fetch('manifest.json').then(r=>r.json())")
        t("PWA manifest", man["display"] == "standalone" and len(man["icons"]) == 2)
        pg.evaluate("navigator.serviceWorker.ready.then(()=>true)")
        pg.reload(); pg.wait_for_selector(".tile"); time.sleep(1)
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_selector(".tile", timeout=8000)
        t("オフラインで起動（Service Worker）", pg.locator(".tile").count() == 6)
        ctx.set_offline(False)
        t("JavaScriptエラーなし " + "; ".join(errs[:3]), not [e for e in errs if "Failed to load resource" not in e])
        # PC幅・ダークモード
        ctx2 = b.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
        p2 = ctx2.new_page(); p2.goto(URL); p2.wait_for_selector(".tile")
        p2.evaluate("__app.showQ('F33')"); p2.screenshot(path=f"{SHOT}/07_pc_dark.png", full_page=True)
        bg = p2.evaluate("getComputedStyle(document.body).backgroundColor")
        t("ダークモード配色", bg != "rgb(255, 255, 255)")
        ctx3 = b.new_context(viewport={"width": 820, "height": 1180})
        p3 = ctx3.new_page(); p3.goto(URL); p3.wait_for_selector(".tile")
        t("iPad幅で横スクロールなし", p3.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
        b.close()
finally:
    srv.terminate()
ok = sum(1 for _, c in res if c); ng = len(res) - ok
print(f"E2E: {ok} passed, {ng} failed")
json.dump(res, open(os.path.join(SHOT, "e2e.json"), "w"), ensure_ascii=False)
sys.exit(1 if ng else 0)
