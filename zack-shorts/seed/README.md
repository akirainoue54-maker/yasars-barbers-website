# What Really Happens When You Swallow A Watermelon Seed

33.2秒、1080×1920、30fps。3Dは Three.js で一から作り、ヘッドレス Chromium で描画しています。

| ファイル | 中身 |
|---|---|
| `final.mp4` | 完成版（音声 AAC 256k、-14.0 LUFS、トゥルーピーク -1.5 dB） |
| `script.txt` | 台本の決定稿（酸素の一文だけ案Bに変更） |
| `sources.md` | 事実確認の結果と出典、各テロップの根拠 |
| `credits.md` | 効果音とBGMの出典（すべてCC0） |
| `voiceover.mp3` | ナレーション（ElevenLabs、Mike - 2D / 3D POV Storytime） |
| `words.json` | 単語ごとのタイムスタンプ（Parakeet TDT で取得） |
| `engine/` | 3Dシーン、カメラ、字幕とテロップ（`shots.js` がタイムライン） |
| `tools/` | タイムスタンプ取得、字幕の分割、効果音のミックス、マスタリング、映像と音の結合 |

## 作り直す手順

依存関係（`engine/` の `npm i`、Parakeet モデル、`/home/user/sfx_src` の CC0 ライブラリ）を準備してから、次の順で実行します。

```bash
python3 tools/align.py            # 単語ごとのタイムスタンプ -> words.json
python3 tools/captions.py         # 字幕の分割 -> engine/data.js
(cd engine && node calibrate.js 90)   # シーンごとに明るさを YAVG 90 に合わせる
(cd engine && ./render_all.sh ../build/final)
python3 tools/mix.py && ./tools/master.sh
./tools/mux.sh build/final/video.mp4 final.mp4
```

一部のシーンだけ直すときは、そのシーンの秒数だけを書き出して差し替えられます。

```bash
cd engine && node render.js video out.mp4 開始秒 終了秒
```
