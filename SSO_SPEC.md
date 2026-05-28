# SSO連携仕様

このファイルは、Dailytallyにシングルサインオンを接続する担当者向けの仕様です。

## 前提

DailytallyはCloudflare Workers上で動作します。SSO側で認証済みのユーザー情報をWorkerへ渡し、Dailytallyはその情報を使って入力権限を制御します。

ユーザー追加、パスワード管理、ユーザーの所属伝道会管理はSSO側で行います。Dailytally側ではパスワードを持ちません。

## 渡してほしいユーザー情報

SSO側から以下のHTTPヘッダーをWorkerへ渡してください。

| ヘッダー | 必須 | 内容 |
| --- | --- | --- |
| `x-dailytally-login-id` | 推奨 | ログインID |
| `x-dailytally-fellowship` | 必須 | 伝道会名 |
| `x-dailytally-name` | 推奨 | 氏名 |
| `x-dailytally-email` | 推奨 | メールアドレス |
| `x-dailytally-role` | 任意 | ロール（`admin` で管理ページ表示） |

メールアドレスはCloudflare Access標準の `cf-access-authenticated-user-email` でも代用できます。

## 伝道会名

`x-dailytally-fellowship` は以下のいずれかと完全一致させてください。

- 大江戸
- お台場
- 羽田
- かながわ
- 富士山
- 駿天
- 埼玉
- 千葉
- 山梨

表記ゆれがあると入力権限が正しく判定できないため、正確に設定してください。

## 権限制御

ログインユーザーの情報に基づき、Dailytallyは以下のように制御します。

- 自分の伝道会ページ: 入力可能
- 他の伝道会ページ: 閲覧のみ
- 合計ページ: 閲覧のみ
- 管理ページ: `x-dailytally-role` が `admin` の場合のみ表示

SSO未連携、または `x-dailytally-fellowship` が空の場合は、移行期間用として全権限（管理者相当）を付与しています。

## ユーザー情報API

Dailytallyのフロントエンドは、ログインユーザー情報を以下のAPIから取得します。

```http
GET /api/me
```

レスポンス例:

```json
{
  "loginId": "ooedo01",
  "fellowship": "大江戸",
  "name": "山田太郎",
  "email": "taro@example.com",
  "role": "admin"
}
```

SSOヘッダーが無い場合は空の値を返します。

```json
{
  "loginId": "",
  "fellowship": "",
  "name": "",
  "email": "",
  "role": ""
}
```

## フロントエンド側の直接指定

開発や検証用に、HTML側で `window.DAILY_TALLY_USER` を先に定義しておくと、`/api/me` より優先して使います。管理者としてテストする場合は `role: "admin"` を含めてください。

```html
<script>
  window.DAILY_TALLY_USER = {
    loginId: "ooedo01",
    fellowship: "大江戸",
    name: "山田太郎",
    email: "taro@example.com",
    role: "admin"
  };
</script>
```

本番ではSSOヘッダー連携を使う想定です。

## 保存APIでの制限

以下のエンドポイントで、Worker側で伝道会の書き込み権限を確認します。

- `POST /api/tallies` (集計入力)
- `POST /api/fellowship-targets` (伝道会別目標)

保存リクエスト内の `fellowshipName` と、SSOから渡された `x-dailytally-fellowship` が一致する場合だけ保存できます。

例:

```json
{
  "ceremonyId": 1,
  "fellowshipName": "大江戸",
  "itemId": 1,
  "date": "2026-04-28",
  "value": 10
}
```

管理者用のエンドポイント (`/api/ceremony-settings`、`/api/summary-targets`、`/api/report-settings`、`/api/report-pdf`、`/api/report-send`) は `x-dailytally-role: admin` のときだけ受け付けます。

## 注意点

- DailytallyはSSOトークンの検証方法をまだ持っていません。認証済みリクエストだけがWorkerに届くよう、SSO側またはCloudflare Access側で保護してください。
- `x-dailytally-fellowship` はユーザーが改ざんできない場所で付与してください。
- 管理者権限を付与する場合は、SSO側で `x-dailytally-role: admin` ヘッダーを付与するように設定してください。
