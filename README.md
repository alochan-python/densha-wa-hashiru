# 電車は走る テスト対策アプリ

中学1年 国語「電車は走る」（重松清）の定期テスト対策アプリ。予想問題292問、傍線部読解、模擬試験3回分（各100点）、復習スケジュールつき。HTML/CSS/JavaScriptだけで動き、APIキー・課金は不要。

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
| `src/` | 問題データ（`q_*.py`, `passages.py`）、アプリ本体（`app.*`, `core.js`）、ビルドスクリプト |
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
