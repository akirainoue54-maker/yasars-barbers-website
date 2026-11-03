# need_from_akira.md (gum)

## 環境（いちばん大事）
- このセッションはクラウドのコンテナで動いていて、Akira の PC ではない。~/zack-shorts、zack_bible.md (v2)、blood/ の shots.py / zack_template.py / 素材、Rocketbox の男性、Blender、RX 7800 XT はどれもここにはない。
- ネットワーク制限で、download.blender.org と Hugging Face（Whisper のモデル）への接続が 403 で拒否された。
- → PC 側でセッションを開いてもらう必要がある（Claude Desktop、または ~/zack-shorts で `claude remote-control`）。

## 制作に必要なもの
- zack_bible.md v2 の字幕ルール（1枚あたりの語数・文字数、色、位置）→ tools/make_captions.py の MAX_WORDS などに入れる
- 数字テロップのルール（7 YEARS / DAY 3 のフォント、出し方）→ shot_plan.csv の onscreen_number 列で確認
- Rocketbox の男性の口まわり（唇・歯・舌）が超接写に耐えるか、PC で確認
- 臓器モデル：NIH 3D で、CC0 か CC BY の食道・胃・小腸・大腸（なければ手続き的に作る）
