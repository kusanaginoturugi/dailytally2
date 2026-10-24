# 脆弱性点検履歴

## 2026-10-24

- 作業開始時の `npm audit` は 14 件（High 12、Moderate 1、Low 1）。作業中に main の先行コミットが `@cloudflare/puppeteer` を 1.4.0、`wrangler` を 4.149.0 に更新し、11 件（High 9、Moderate 2）になった。先行コミットを取り込んだうえで `wrangler` を 4.152.0 に更新した。
- `ip-address` 10.7.4 と `undici` 7.30.1 を `overrides` に固定。後者は `miniflare` の指定版 7.29.1 を上書きしている。Wrangler の dry-run ビルドとローカル起動は確認済み。上流が修正版を直接採用したら両 override を外す。
- 更新後の `npm audit` は High 7 件。本番依存のみの `npm audit --omit=dev --audit-level=high` は 0 件。残件は `@cloudflare/puppeteer` → `@puppeteer/browsers` → `extract-zip`（修正版未公開）、`proxy-agent` → `pac-proxy-agent` → `get-uri` → `basic-ftp`（修正版 6.2.3 は現行の 5.x 指定からメジャー更新が必要）の 2 経路と、その親パッケージへの波及。PDF 生成で `@cloudflare/puppeteer` は Worker から import されるが、指摘の下位パッケージ名は dry-run の Worker bundle に見つからなかった。インストール時・開発時のリスクは残るため、上流の更新を週次で追う。`npm audit fix --force` が提案する 0.0.11 へのダウングレードは実施していない。
- コード側は、OIDC の必須設定が欠けた場合の無認証動作、クライアント送信ヘッダーによる権限昇格、userinfo 取得失敗時の未検証 ID token への依存、ログイン後の外部 URL リダイレクト、POST 本文の無制限読み込み、異なる Origin からの POST、報告先から返された URL への Cookie 付きリクエスト、集計表の `innerHTML` を修正した。報告先 URL は `tendo.net` とそのサブドメインの HTTPS のみに制限した。外部ドメインの iframe を使う送信先の場合は、実送信前に送信先を確認して許可リストへ追加する必要がある。
- `npm ci`、`npm test`、`npm run build`、ローカル `wrangler dev` 起動と `/api/me` の 503 応答、`git diff --check` は成功。本番 Worker に `AUTHENTIK_CLIENT_SECRET` と `SESSION_SECRET` が登録済みであることを名前で確認した。実際の OIDC ログインと tendo.net への報告送信は未実施。先行コミットの `REPORT_REMOTE_SUBMIT` は `true` なので、URL 制限の影響を実送信前に確認する。デプロイは未実施。
- 既存の週次 Dependabot と CI を維持し、CodeQL、Dependency Review、CI のテストと本番依存 audit を追加。GitHub の Dependabot 脆弱性アラートは API で有効化し、GET の HTTP 204 を確認。確認直後の open アラートは空。main の保護設定と Dependabot security updates は変更していない。
