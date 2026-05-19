# Cloudflare デプロイ手順

dailytally2 を Cloudflare Workers にデプロイし、旧 [Dailytally](https://github.com/kusanaginoturugi/Dailytally) と並走させる手順。

## 前提

- 旧 Dailytally と同じ Cloudflare アカウントにログイン済み
- authentik の OIDC Provider が稼働中(旧 Dailytally と同じものを流用予定)
- D1 データベース `dailytally2` は作成済み(`wrangler.toml` の `database_id` は設定済み)
- 各 secret の値が手元にある(旧側からは値を読み出せないため別途控えが必要)

## 手順

### 1. Cloudflare ログイン確認

```sh
cd ~/src/dailytally2
npx wrangler whoami
```

旧 Dailytally と同じアカウントが表示されればそのまま進む。違っていれば `npx wrangler login`。

### 2. D1 にマイグレーション適用

```sh
npm run db:migrate:remote
```

10 テーブル + シード(9 伝道会 / 9 護摩供 / 84 集計項目 / `report_settings` 初期行 / `app_settings.active_ceremony_id=1`)が入る。

### 3. シークレット投入

旧と同じ値を `wrangler secret put` で個別に入れる。

```sh
npx wrangler secret put AUTHENTIK_ISSUER --name dailytally2
npx wrangler secret put AUTHENTIK_CLIENT_ID --name dailytally2
npx wrangler secret put AUTHENTIK_CLIENT_SECRET --name dailytally2
npx wrangler secret put SESSION_SECRET --name dailytally2
npx wrangler secret put TENDO_ACCOUNT --name dailytally2
npx wrangler secret put TENDO_PASSWORD --name dailytally2
npx wrangler secret put RESEND_API_KEY --name dailytally2
npx wrangler secret put REPORT_NOTIFY_FROM --name dailytally2
```

`REPORT_REMOTE_SUBMIT` (tendo 実送信フラグ) は並走中は **入れない or `false`** にしておく。動作確認後、旧から切り替えるタイミングで `true` に設定する。

### 4. デプロイ

```sh
npm run deploy
```

成功すると `https://dailytally2.<account>.workers.dev/` が生える。

### 5. authentik 側に新 Redirect URI を追加

authentik の Provider 設定で、現行の Redirect URI に加えて以下を追加する。

```
https://dailytally2.<account>.workers.dev/auth/callback
```

**ここを忘れるとログインが通らない**。新規 Provider を作成する場合は scope `openid profile email groups` も忘れずに。

### 6. データ移行(任意)

旧 D1 の `app_state.data` を新スキーマへ取り込む。

```sh
npx wrangler d1 execute dailytally --remote \
  --command "SELECT data FROM app_state WHERE id='main'" --json > legacy.json
node scripts/migrate-from-v1.mjs --in legacy.json --out migration.sql
npx wrangler d1 execute dailytally2 --remote --file migration.sql
```

`__final__` 行は移行スクリプトが `end_at` セルに寄せる。実行後、新側で集計値・目標・送信履歴が正しく入っているか確認する。

### 7. 動作確認

- `https://dailytally2.<account>.workers.dev/auth/login` でログインフローを確認
- `https://dailytally2.<account>.workers.dev/api/me` で `loginId` / `fellowship` / `role` が返るか確認
- 管理ページで護摩供切替・期間設定・報告設定の保存
- 各伝道会タブで入力が通るか(累計検証エラーも含めて)
- 合計ページで PDF 出力が動くか(`/api/report-pdf` admin のみ)
- 「今すぐ送信」(`REPORT_REMOTE_SUBMIT` を `true` にする前は失敗するのが正常)

### 8. 本番切替

カスタムドメインを使っている場合は、最後に DNS / Cloudflare Routes を旧 Worker から新 Worker に付け替える。URL を変えずに移行できる。

- 切替前: `REPORT_REMOTE_SUBMIT=true` を新側に設定
- 切替後: 旧 `dailytally` Worker は `wrangler delete` するか、cron トリガを外して凍結

## 並走で踏みやすい地雷

- **cron 二重発火**: 旧・新ともに `*/15 * * * *` cron が動くため、`REPORT_REMOTE_SUBMIT=true` を両方で有効にすると tendo へ二重送信される。新側は当面 `false` のまま。
- **secrets の控え**: `wrangler secret list --name dailytally` で名前は出るが値は出ない。`TENDO_PASSWORD` 等の控えが無いなら再発行を先に手配する。
- **authentik Redirect URI**: Provider に新 URI を追加し忘れるとログインが通らない。
- **ブラウザのセッション残り**: 旧 Dailytally に admin でログインしていた状態で新側にアクセスしても自動的にはログインされない。`/auth/login` を踏み直す。
- **D1 のローカルとリモート**: `--local` と `--remote` を取り違えるとローカルにマイグレーションが当たって本番が無傷になる(またはその逆)。コマンドの末尾を毎回確認する。
