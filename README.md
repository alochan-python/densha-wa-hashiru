# 国語中間テスト対策アプリ（竹取物語・電車は走る）

中学1年 国語の定期テスト対策アプリ。教材を「①竹取物語／②電車は走る／総合」で切り替えられ、学習記録は教材ごとに別々に管理。予想問題548問（竹取物語254・電車は走る294）、傍線部読解（古文含む）、模擬試験9回分（各教材3回＋総合3回、各100点）、漢字11問・語句37語の全問正解モード、復習スケジュールつき。HTML/CSS/JavaScriptだけで動き、APIキー・課金は不要。

> ⚠️ 教科書本文の一部（引用）と学校の過去問の分析を含むため、**このリポジトリは Private（非公開）で使ってください。**

## 使い方
- `docs/index.html` をブラウザで開けばそのまま使えます。
- GitHub Pages（Settings → Pages → Branch: `main` / フォルダ: `/docs`）で公開すると、iPhoneのSafariで「ホーム画面に追加」でき、オフラインでも動きます。
  - ※無料プランの GitHub Pages は公開URLになります（リポジトリが Private でもページは誰でも見られます）。家族だけで使うなら、URLを人に教えない運用にするか、Pages を使わず `docs/index.html` を直接開いてください。
- 印刷用PDF：`docs/pdf/`（模擬試験の問題用紙・解答用紙・模範解答、Sランク・語句・漢字一覧、報告書）

## フォルダ
| パス | 中身 |
|---|---|
| `docs/` | 完成したアプリ（PWA）とPDF |
| `src/` | 問題データ（電車は走る：`q_*.py`, `passages.py`／竹取物語：`tk_*.py`）、アプリ本体（`app.*`, `core.js`）、ビルドスクリプト |
| `tests/` | 単体テスト（Node）・E2Eテスト（Playwright） |

## 問題を直す・増やすとき
```bash
cd src
python3 build.py      # 問題データを検証して data.json を作る（エラーがあれば表示）
python3 assemble.py   # docs/index.html などを作り直す
python3 print.py      # docs/pdf/ のPDFを作り直す（Playwright が必要）
cd ..
node tests/test_core.js         # 単体テスト
python3 tests/test_e2e.py       # E2Eテスト（Playwright + Chromium）
```
