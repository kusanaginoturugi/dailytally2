# dailytally2

旧 [Dailytally](../Dailytally) の作り直し版。基本機能はそのままで、テーブル設計を正規化した「普通の DB ウェブアプリケーション」構造にしている。

- ランタイム: Cloudflare Workers + D1 + Browser Rendering
- ストレージ: D1 を正規化テーブルで使用 (`fellowships`, `ceremonies`, `tally_items`, `tallies`, `fellowship_targets`, `summary_target_overrides`, `users`, `report_settings`, `report_history`, `app_settings`)
- 認証: authentik OIDC または SSO ヘッダ (`x-dailytally-*` / `x-authentik-*`)
- フロント: 素の JS / HTML / CSS (旧版を新 API に合わせて書き直し)

## ディレクトリ

```
dailytally2/
├── migrations/         D1 スキーマと初期データ
├── public/             ブラウザに配信される静的アセット (index.html / app.js / style.css)
├── scripts/            移行スクリプト等
├── src/
│   ├── lib/            日付・cookie・認証・レスポンスのヘルパ
│   ├── routes/         /api/* と /auth/* のハンドラ
│   ├── services/       護摩供・集計・目標・ユーザー・報告・PDF・送信
│   └── worker.js       エントリポイント (fetch / scheduled)
├── package.json
└── wrangler.toml
```

## できること

- 9 つの伝道会ごとに、指定期間の累計値を入力
- 9 種類の護摩供を切り替えて管理
- 護摩供ごとに項目・単位を分けて持つ (`tally_items` テーブル)
- 合計ページで日次合計と最終値を確認
- 護摩供別の週開始日 / 最終日 / 得道者数開始日を設定
- 個別目標 (伝道会ごと) と合計目標の上書き
- A4 横 PDF を Browser Rendering で生成
- tendo.net への自動 / 手動送信、Resend でのメール通知
- authentik (OIDC) ログインまたは SSO ヘッダによる権限制御
- 15 分 cron で送信時刻に到達したか判定

## セットアップ

1. 依存関係をインストール

   ```sh
   npm install
   ```

2. D1 データベースを作成

   ```sh
   npx wrangler d1 create dailytally2
   ```

3. 表示された `database_id` を `wrangler.toml` の `database_id` に貼り付ける (現在は `REPLACE_WITH_REAL_ID`)

4. ローカルにマイグレーションを適用

   ```sh
   npm run db:migrate:local
   ```

5. ローカル起動

   ```sh
   npm run dev
   ```

6. 本番にマイグレーションを適用

   ```sh
   npm run db:migrate:remote
   ```

7. デプロイ

   ```sh
   npm run deploy
   ```

## 環境変数とシークレット

公開されても問題ない環境ごとの設定は `wrangler.toml` の `[vars]` に置く。

```toml
[vars]
AUTHENTIK_ISSUER = "https://auth.showway.biz/application/o/dailytally2/"
AUTHENTIK_CLIENT_ID = "..."
REPORT_REMOTE_SUBMIT = "false"
# TENDO_ACCOUNT = ""
# REPORT_NOTIFY_FROM = "Dailytally <notify@example.com>"
# REPORT_ONLINE_FORM_URL = ""
# REPORT_ONLINE_FILE_FIELD = "up_file[]"
```

秘匿が必要な値だけ `wrangler secret put` で個別に設定する。

```sh
npx wrangler secret put --name dailytally2 AUTHENTIK_CLIENT_SECRET
npx wrangler secret put --name dailytally2 SESSION_SECRET
npx wrangler secret put --name dailytally2 TENDO_PASSWORD
npx wrangler secret put --name dailytally2 RESEND_API_KEY
```

ローカル開発時は `.dev.vars.example` を `.dev.vars` にコピーして値を埋める。

## 旧 Dailytally からのデータ移行

旧 D1 (`dailytally`) の `app_state.data` を新スキーマに流し込む。

```sh
# 1) 旧 D1 から JSON を取り出す
npx wrangler d1 execute dailytally --remote \
  --command "SELECT data FROM app_state WHERE id='main'" --json > legacy.json

# 2) 変換 SQL を生成
node scripts/migrate-from-v1.mjs --in legacy.json --out migration.sql

# 3) 新 D1 に適用
npx wrangler d1 execute dailytally2 --remote --file migration.sql
```

`--remote` を `--local` に変えればローカル D1 でも同じ手順で動く。

## API

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET  | `/api/me` | 現在のログインユーザー |
| GET  | `/api/bootstrap` | 初期表示に必要な全データ |
| POST | `/api/active-ceremony` | 現在の護摩供を切替 |
| POST | `/api/ceremony-settings` | 護摩供の期間設定 (admin) |
| POST | `/api/tallies` | 集計値を更新 |
| POST | `/api/fellowship-targets` | 伝道会別目標を更新 |
| POST | `/api/summary-targets` | 合計ページの目標上書き (admin) |
| POST | `/api/report-settings` | オンライン報告設定 (admin) |
| PUT  | `/api/users` | ユーザー一覧の置換 (admin) |
| GET  | `/api/report-pdf` | 集計 PDF を生成 (admin) |
| POST | `/api/report-send` | 手動送信を実行 (admin) |

詳細な権限制御は [SSO_SPEC.md](SSO_SPEC.md) を参照。

## オンライン報告

旧 Dailytally と同じく、管理ページで送信時刻・送信者名・伝道会名・通知先メールを設定。15 分間隔の cron で `report_settings.send_time` を判定し、期間中なら自動送信する。

tendo.net への実送信は `REPORT_REMOTE_SUBMIT=true` のときのみ走る。送信ボタンは常に `mirokuji` (弥勒寺へ送信)。

## コードメモ

旧 README から引き継ぎ:

- `99300` 聖明王院
- `31101` 埼玉準公壇
- `31201` 千葉準公壇
- `31303` 大江戸準総壇
- `31304` 羽田準総壇
- `31305` お台場準総壇
- `31407` かながわ準総壇
- `32204` 富士山準総壇
- `32205` 駿天準総壇
