# Does Coke Dissolve A Tooth Overnight?

33.2秒、1080×1920、30fps。3Dは Three.js で一から作り、ヘッドレス Chromium で描画しています（`../seed/` と同じ方式）。

| ファイル | 中身 |
|---|---|
| `final.mp4` | 完成版（音声 AAC 256k、-14.0 LUFS、トゥルーピーク -1.5 dB） |
| `publish.md` | タイトル案・説明欄・タグ・直した方がいい点 |
| `script.txt` | 台本（そのまま使用） |
| `sources.md` | 事実確認の結果、出典、確度、各テロップの根拠 |
| `credits.md` | 効果音とBGMの出典（すべてCC0） |
| `voiceover.mp3` | ナレーション（ElevenLabs、渡された音声） |
| `words.json` | 単語ごとのタイムスタンプ（Parakeet TDT。音声の波形で補正する前の値） |
| `engine/` | 3Dシーン（`shots.js` がタイムライン）、字幕とテロップ（`overlay.js`）、シーンごとの露出カーブ（`gains.js`） |
| `tools/` | 単語の開始時刻の補正、字幕の分割、効果音のミックス、マスタリング、映像と音の結合 |

## 作り直す手順

`../seed/` と同じ準備（`engine/` で `npm i three@0.170.0 @fontsource/montserrat`、Parakeet モデル、CC0 ライブラリ）をしてから、次の順で実行します。

```bash
python3 ../seed/tools/align.py          # seed の align.py をこのフォルダで実行（tools/align.py にコピー済み）
python3 tools/onsets.py                 # 各単語の開始時刻を音声の波形から補正 -> build/onsets.json
python3 tools/captions.py               # 字幕の分割 -> engine/data.js
(cd engine && node calibrate.js 90)     # 時間ごとの露出カーブ（3〜5回繰り返すと収束）
(cd engine && ./render_all.sh ../build/final)
python3 tools/mix.py && ./tools/master.sh
./tools/mux.sh build/final/video_graded.mp4 final.mp4
```

一部のシーンだけ直すときは、その秒数だけを書き出して差し替えられます。

```bash
cd engine && node render.js video out.mp4 開始秒 終了秒
```
