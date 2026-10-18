import json, os, shutil
B = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(B, "..", "docs")
os.makedirs(OUT, exist_ok=True)
data = open(os.path.join(B, "data.json")).read()
html = open(os.path.join(B, "app.html")).read()
html = (html.replace("/*CSS*/", open(os.path.join(B, "app.css")).read())
            .replace("/*CORE*/", open(os.path.join(B, "core.js")).read())
            .replace("/*DATA*/", json.dumps(json.loads(data), ensure_ascii=False, separators=(",", ":")))
            .replace("/*APP*/", open(os.path.join(B, "app.js")).read()))
# 単体ファイル（アーティファクト用：骨組みは公開時に付与される）
open(os.path.join(B, "..", "build-artifact.html"), "w").write(html)
# PWA 用の完全なHTML
full = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}[hidden]{display:none!important}</style>'
        '</head><body>' + html + '</body></html>')
open(os.path.join(OUT, "index.html"), "w").write(full)
json.dump({"name": "電車は走る テスト対策", "short_name": "電車は走る", "start_url": "./index.html", "display": "standalone",
           "background_color": "#F6F8F7", "theme_color": "#2C5D8F", "lang": "ja",
           "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}]},
          open(os.path.join(OUT, "manifest.json"), "w"), ensure_ascii=False, indent=1)
open(os.path.join(OUT, "sw.js"), "w").write("""const CACHE='densha-v2';
const FILES=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp)).catch(()=>{});return res;}).catch(()=>caches.match('./index.html')));return;}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});return res;}).catch(()=>caches.match('./index.html'))))});
""")
font = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
for n in ((192, 512) if os.path.exists(font) else ()):  # フォントがない環境ではアイコンは作り直さない
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("RGB", (n, n), "#2C5D8F"); d = ImageDraw.Draw(im)
    d.rounded_rectangle([n*0.08, n*0.62, n*0.92, n*0.70], radius=n*0.04, fill="#FFFFFF")
    f = ImageFont.truetype(font, int(n*0.5), index=0)
    d.text((n/2, n*0.36), "電", font=f, fill="#FFFFFF", anchor="mm")
    for x in (0.28, 0.72):
        d.ellipse([n*x-n*0.06, n*0.74, n*x+n*0.06, n*0.86], fill="#C4122F")
    im.save(os.path.join(OUT, f"icon-{n}.png"))
open(os.path.join(OUT, "README.txt"), "w").write("""電車は走る テスト対策アプリ（オフライン版）

■ いちばん簡単な使い方
index.html をブラウザ（Safari / Chrome / Edge）で開くだけで使えます。インターネット接続は不要です（文字の書体だけはネット接続時のみ）。

■ iPhone / iPad のホーム画面に置く（PWA）
このフォルダを https で配信できる場所（例：GitHub Pages、Netlify Drop など無料サービス）に置いて Safari で開き、
共有ボタン →「ホーム画面に追加」。一度開けばオフラインでも動きます（sw.js がキャッシュします）。
※ファイルを直接開いた場合（file://）はオフライン用キャッシュ（Service Worker）は働きませんが、アプリ自体はそのまま動きます。

■ 記録
記録はブラウザの中（localStorage）に保存されます。別の端末に移すときは「記録」タブのバックアップ → 復元を使ってください。
""")
print("ok", len(full)//1024, "KB")
