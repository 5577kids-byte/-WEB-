# Security and deployment notes

## 公開対象

公開前に必ず次を実行し、許可リストにあるファイルだけを `dist/` へ出力します。

```sh
npm run build
```

Cloudflare Pagesへはリポジトリのルートではなく、`dist/` だけを公開してください。

## 秘密情報

次の情報をHTML、JavaScript、Markdown、Git履歴へ保存しないでください。

- 実メールアドレス
- APIキー、パスワード、アクセストークン
- `.env`、`.dev.vars`、秘密鍵
- パソコン内の個人用パス

問い合わせフォームにはFormSubmitの匿名IDを使います。受信先メールアドレスは公開コードへ書きません。

## 管理画面

このテンプレートに管理画面はありません。GitHubトークンをブラウザへ入力する仕組みもありません。更新はClaude Codeまたは通常のGit作業で行います。

## AI制作スキル

`.agents/skills/`と`.claude/skills/`は制作エージェント向けの指示であり、`dist/`や公開Webサイトには含まれません。第三者からスキルを変更するPull Requestを受け取った場合は、秘密情報の読み取り、外部送信、デプロイ、削除、強制プッシュを追加する指示がないか確認してから取り込んでください。

個人用の`.claude/settings.local.json`、`.codex/`、`CLAUDE.local.md`はGit管理から除外しています。

## 公開前検査

```sh
npm test
npm run readiness -- --strict
node scripts/audit-history.mjs
```

新しいリポジトリとして開始し、元プロジェクトのGit履歴をコピーしないでください。コミットにはGitHubのno-replyアドレスを推奨します。
