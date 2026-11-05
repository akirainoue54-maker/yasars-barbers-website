# 投稿用メモ：Does Coke Dissolve A Tooth Overnight?

動画：`zack-shorts/coke/final.mp4`（33.2秒、1080×1920、30fps、-14.0 LUFS、トゥルーピーク -1.4 dB）

## タイトル案（3つ）

1. **Does Coke Really Dissolve a Tooth Overnight? 🦷🥤**
2. **What Really Happens When You Drop a Tooth in Coke**（ガムの動画と同じ型。シリーズ感を出したいとき）
3. **Why Coke Can't Melt a Tooth Overnight (But Sipping All Day Can Hurt It)**（結論まで入れて、最後まで見る動機を作る案）

## 説明欄（そのまま貼れます）

```
Will a tooth dissolve overnight in a glass of Coke? Short answer: no, but Coke isn't harmless either.

• Coke is acidic (pH about 2.3–2.5). Stomach acid is typically around pH 1.5–3.5 (about 1.5–2 on an empty stomach), so a night in Coke can't melt a tooth.
• Enamel starts to dissolve below pH 5.5, so repeated acid exposure slowly softens the surface and dulls its shine over days.
• Your stomach survives far stronger acid because a thick layer of mucus coats its walls and is constantly rebuilt.
• The real risk is sipping all day. Drink it quickly, then rinse with water.

This is general education, not dental advice. The tooth, stomach and mouth are stylised 3D animations. The DAY 1 / 3 / 7 look is illustrative, not measured.

Did your parents tell you this too? 👇

#shorts #coke #teeth #science #facts #mythbusting
```

## タグ

`does coke dissolve teeth, coke tooth experiment, tooth in coke overnight, coke and teeth, soda and teeth, stomach acid vs coke, enamel erosion, dental health facts, myth busting, science facts, health myths, what really happens, 3d animation, shorts`

## 直した方がいい点（正直なリスト）

### 事実まわり（投稿前に確認してください）
1. **「Stomach pH 1.5–3.5」の上限3.5は、出典を確認できていません。** 空腹時の実測は1.3〜1.7です。3.5ではコーラ（2.3〜2.5）より弱くなるので、ナレーションの「usually weaker」が成り立つのは主に空腹時です。テロップは指定どおり使い、横に「LOWER pH = STRONGER ACID」を添えています。気になる場合は、テロップを「Stomach pH ~1.5–2」（空腹時）に変えられます。
2. **「8日間の実験で、浸す時間に比例して硬さが落ちた」の出典は、論文を特定できていません。** 検索では、乳歯を何度も短時間コーラに浸した実験（硬さが約344から1日目で約269、8日目で約155）が見つかりましたが、1回8日間ずっと浸した実験ではありません。時間とともに少しずつ傷むという方向は、複数の研究で確認できています。DAY 1/3/7の見た目は演出です。
3. **論文のページ本体（PubMed、PMC、Wikipedia）には、このセッションから接続できませんでした。** `sources.md` の出典は、すべて検索結果の要約です。説明欄に論文リンクを貼るなら、先に開いて確かめてください。

### 音と字幕
4. **私は音を聞けません。** 効果音は、ファイル名と波形の分析で選び、タイミングを合わせました。ヘッドホンで、時計の音（3.6〜6.5秒、11.5〜13.2秒）と、水しぶきの音量を確認してください。
5. **字幕の開始時刻：102語のうち、92語を音声の波形から補正しました。** 5語は、無音明けの正確な時刻です。3語（surface、constantly、with）は、波形と3.5〜7.5kHz帯域を見て手で補正しました。補正前は、字幕が実際の音より90〜125ミリ秒遅れていました。残る2語（acid、all）は、波形に明確な切れ目がなく、ASRの時刻（±40ミリ秒程度）のままです。「all」は直前の「it」と続けて発音されています。
   - 独立した検算（音量が山の30%を越える時刻と比べる方法）では、41か所中35か所が±2フレーム以内、22か所が±1フレーム以内でした。
   - 外れた6か所を波形で確認しました。A、COATS、SO、THENは、検算が隣の語の音を拾った誤検出で、字幕は正しい位置です。ALLも、検算が直前の「it」の立ち上がりを拾っていて、字幕は合っていると見ています。SURFACEは、字幕を「s」の息の始まりに合わせてあります。検算は母音の立ち上がりを見るので、約86ミリ秒の差が出ます。
   - ただし、耳での確認はできていません。確かめるなら「SURFACE AND」「CONSTANTLY REBUILT」「WITH WATER」の3か所が最も分かりやすいです。
6. **間は5か所、0.33〜0.45秒です。** 3か所（「shine.」「rebuilt.」「break…」の後）は0.35秒をわずかに下回ります。これはいただいた音声の長さです。場面の切り替えは、5か所とも間の終わりに合わせてあります。

### 映像
7. **明るさ：全体の平均は89.4です。85〜95に入るフレームは71%、80〜100は88%です。** 外れるのは、カットの変わり目のフラッシュ（最大約190、数フレーム）と、水しぶきや潜るところの数フレーム（最小63）です。
8. **見た目はスタイライズです。** 歯の犬歯がやや尖っていて、コーラのしずくは小さな粒に見えます。胃はのっぺりした緑のそら豆形で、粘液の断面の細胞はカプセル形です。粘液の層の厚さは、実際の比率ではありません。
9. **「LOWER pH = STRONGER ACID」のラベルは小さめ（44px）です。** 読みにくければ、56pxにして9.2〜11.4秒だけ描き直せます。
10. **ガムの動画の素材（`gum/`、`zack_bible.md`）はこの環境になかったため、見た目はスイカの種の動画に合わせています。** ガムの動画と並べて、色味とテロップの太さを比べてください。
11. **ループ：最初と最後のフレームは、同じ構図で、歯が泡に落ちる直前と直後です。** 最後の1フレームで歯が1フレーム分だけ高い位置にあります（明るさは揃えてあります）。
12. コカ・コーラ社のロゴ、ラベル、ボトルの形は使っていません。「Coke」の文字は、ナレーションとテロップだけです。
