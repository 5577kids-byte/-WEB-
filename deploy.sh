#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
node scripts/build-public.mjs

if [[ "${1:-}" == "--deploy" ]]; then
  if [[ -z "${CLOUDFLARE_PROJECT_NAME:-}" ]]; then
    echo "CLOUDFLARE_PROJECT_NAME を設定してください。" >&2
    echo "例: CLOUDFLARE_PROJECT_NAME=my-site bash deploy.sh --deploy" >&2
    exit 1
  fi
  npx wrangler pages deploy dist --project-name="$CLOUDFLARE_PROJECT_NAME"
else
  echo "公開用ファイルを dist/ に生成しました。"
  echo "デプロイする場合: CLOUDFLARE_PROJECT_NAME=my-site bash deploy.sh --deploy"
fi
