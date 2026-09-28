# frontend 実装計画

画面の実装（ステップ 1〜8）は完了した。この文書には残りの作業だけを書く。完了した作業は消していく。

- 画面デザイン: https://claude.ai/artifact/TVNGYhmAWCW1o12oHcFMmk （取り出したマークアップ: `docs/spec/display/`）
- 仕様: `docs/spec.md`
- 実装の約束ごと: `apps/frontend/AGENTS.md`

## 残りの作業

ここ（Windows・実機なし）では進められなかった作業。上から順に進める。

1. **Google ログインの設定**
   - Google Cloud Console で OAuth クライアント ID（Web / iOS / Android）を作る。Android は署名鍵ごとの SHA-1 を登録する（デバッグ・リリース・Play App Signing）。
   - アプリに `VITE_GOOGLE_WEB_CLIENT_ID` / `VITE_GOOGLE_IOS_CLIENT_ID`、API（`apps/backend-worker`）に `GOOGLE_CLIENT_IDS`（すべての ID）を設定する。
   - iOS の `ios/App/App/Info.plist` の `CFBundleURLTypes` に、iOS クライアント ID を逆順にした URL スキームを足す。
   - 設定するまで「Googleでログイン」は無効のまま（ローカルではようこそ画面の開発用ログインを使う）。
2. **アプリアイコン・スプラッシュ**: 元画像を用意し、`@capacitor/assets` などで iOS / Android の各サイズを生成する。
3. **実機での確認**（iOS は Mac の Xcode が要る）
   - カメラ・写真の権限ダイアログと、その文言
   - 招待 QR コードの読み取り
   - 資格情報の Keychain / Keystore への保存（再起動後もログインが続くこと）
   - Google ログイン
   - ノッチ・ホームインジケーターまわりの表示（セーフエリア）
   - 本番 API への接続と CORS（`capacitor://localhost` / `https://localhost`）

## 未決事項

決まったら、上の「残りの作業」に作業として移す。

- 規約・プライバシーポリシー・ヘルプの公開場所（アプリの `VITE_TERMS_URL` / `VITE_PRIVACY_URL` / `VITE_HELP_URL`。未設定の間はリンクが無効）と、規約を改定するときに `TERMS_VERSION` をアプリ（`src/terms.ts`）と API（`wrangler.jsonc`）で揃える運用。
- 本番の API の URL（アプリの `VITE_API_BASE_URL`）と、API の `ALLOWED_ORIGINS`。
- フォントとアイコン: デザインは `Zen Kaku Gothic New` / `IBM Plex Mono` / `Material Symbols Rounded`、今のアプリは `Noto Sans JP`（同梱）/ `@mdi/font`。デザインのトーンは仮置きなので、差し替えるか今のものを使い続けるかを決める（どちらでもアプリに同梱し、外部から読み込まない）。
- デザインにない画面（空状態・メンバー向けの設定・退会の確認など）の見た目を Claude Design で描き足すか。
