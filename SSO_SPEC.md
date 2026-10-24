# SSO 連携仕様

現行の認証は authentik OIDC。`AUTHENTIK_ISSUER`、`AUTHENTIK_CLIENT_ID`、`AUTHENTIK_CLIENT_SECRET`、`SESSION_SECRET` がそろわない場合、Worker は HTTP 503 を返す。

## ログインと権限

- `/auth/login` で Authorization Code + PKCE を開始する。
- `/auth/callback` はトークン交換後、userinfo を取得する。userinfo の `sub` がない、または ID token の `sub` と一致しない場合はセッションを作らない。
- `groups`、`group`、`ak_groups` に `admin`、`dailytally-admin`、`管理者` のいずれかがあれば管理者。
- 所属伝道会はグループ名の `大江戸`、`お台場`、`羽田`、`かながわ`、`富士山`、`駿天`、`埼玉`、`千葉`、`山梨` から決める。
- 管理者は全伝道会と設定を更新できる。一般ユーザーは自分の伝道会だけ更新できる。所属やユーザー情報が空なら書き込みできない。

Worker はセッションから取得した情報で内部の `x-dailytally-*` ヘッダーを設定する。クライアントが送った同名ヘッダーや `x-authentik-*` ヘッダーは権限判定に使用しない。Cloudflare Access のヘッダーだけで認証する構成には対応していない。

## authentik 側の設定

- Redirect URI に `https://<公開ホスト>/auth/callback` を登録する。
- scope は `openid profile email groups` を許可する。
- userinfo で `sub` と権限に必要なグループを返す。

フロントエンドは `GET /api/me` で現在のユーザー情報を取得する。`window.DAILY_TALLY_USER` は画面表示用の開発補助であり、Worker の権限には影響しない。
