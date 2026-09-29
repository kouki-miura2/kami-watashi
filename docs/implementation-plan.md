# frontend 実装計画

この文書には、まだ終わっていない作業だけを書く。終わった作業は消す。

- 画面デザイン: https://claude.ai/artifact/TVNGYhmAWCW1o12oHcFMmk （取り出したマークアップ: `docs/spec/display/`）
- 仕様: `docs/spec.md`
- 実装の約束ごと: `apps/frontend/AGENTS.md`

## 残りの作業

方針を Capacitor のネイティブアプリ（ストア配信）から Webアプリに変えた（`docs/spec.md`「提供形態」「アーキテクチャ」）。コードの Webアプリ化（Cookie 認証、Capacitor の撤去、PWA 対応）と、画面と API を1つの Worker から配信する構成、初回のデプロイと Google Cloud Console の設定は済んだ。上から順に進める。

1. **スマートフォンでの確認**（iPhone の Safari、Android の Chrome）
   - カメラでの撮影と、保存済みの写真の選択
   - 招待QRコードを読み取って参加できること: アプリの参加画面のカメラ（カメラの許可ダイアログを含む）と、スマートフォンの標準のカメラの両方
   - Cookie が続くこと: 7日以上あけて開いてもログインしたままか（Safari の ITP）。ホーム画面に追加したアプリで、Safari でのログイン状態が引き継がれるか（引き継がれない場合の案内も決める）
   - Googleログイン
   - ホーム画面に追加したときの表示（アイコン、全画面、ノッチ・ホームインジケーターまわりのセーフエリア）

## 未決事項

決まったら、上の「残りの作業」に作業として移す。

- 独自ドメイン: PoC の後、`*.workers.dev` から独自ドメインに移すか。
- PoC 中のオーナー登録を制限するか（告知しないだけにするか、許可したアカウントだけにするか）。
- 収益化: PoC の手ごたえを見て、決済（Stripe 等）か広告を決める。
- 規約・プライバシーポリシー・ヘルプの公開場所（アプリの `VITE_TERMS_URL` / `VITE_PRIVACY_URL` / `VITE_HELP_URL`。未設定の間はリンクが無効）と、規約を改定するときに `TERMS_VERSION` をアプリ（`src/terms.ts`）と API（`wrangler.jsonc`）で揃える運用。
- アプリアイコン: 今の `apps/frontend/public/icon.svg`（朱色に角を折ったプリント）は仮。正式なデザインにするか決める（作り直し方は `apps/frontend/AGENTS.md` の PWA の項）。
- フォントとアイコン: デザインは `Zen Kaku Gothic New` / `IBM Plex Mono` / `Material Symbols Rounded`、今のアプリは `Noto Sans JP`（同梱）/ `@mdi/font`。デザインのトーンは仮置きなので、差し替えるか今のものを使い続けるかを決める（どちらでもアプリに同梱し、外部から読み込まない）。
- デザインにない画面（空状態・メンバー向けの設定・退会の確認など）の見た目を Claude Design で描き足すか。
