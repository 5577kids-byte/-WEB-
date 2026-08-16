import { readFile } from 'node:fs/promises';

const strict = process.argv.includes('--strict');
const sourceFiles = [
  'index.html',
  'services.html',
  'about.html',
  'contact.html',
  'privacy.html',
  'legal.html',
  '404.html',
  'mobile.html',
  'sitemap.xml',
  'robots.txt',
  'favicon.svg',
  'LICENSE',
];

const checks = [
  { label: '屋号・会社名', pattern: /YOUR BRAND/g },
  { label: '担当者名', pattern: /YOUR NAME|山田 太郎/g },
  { label: '公開URL・外部リンク', pattern: /https:\/\/example\.com/g },
  { label: 'GitHubユーザー名', pattern: /YOUR_GITHUB_USERNAME/g },
  { label: '問い合わせフォームID', pattern: /YOUR_FORMSUBMIT_FORM_ID/g },
  { label: '法務ページの更新日', pattern: /YOUR LAST UPDATED DATE/g },
  { label: 'プロフィール画像', pattern: /profile-placeholder\.jpg/g },
];

const sources = new Map();
for (const file of sourceFiles) {
  sources.set(file, await readFile(file, 'utf8'));
}

const remaining = [];
for (const check of checks) {
  const files = [];
  let count = 0;
  for (const [file, source] of sources) {
    const matches = source.match(check.pattern) || [];
    if (!matches.length) continue;
    files.push(file);
    count += matches.length;
  }
  if (count) remaining.push({ ...check, count, files });
}

if (!remaining.length) {
  console.log('公開準備チェック: ダミー情報は残っていません。');
  process.exit(0);
}

console.log(`公開準備チェック: 未設定の項目が ${remaining.length} 種類あります。`);
for (const item of remaining) {
  console.log(`- ${item.label}: ${item.count}箇所 (${item.files.join(', ')})`);
}

if (strict) {
  console.error('ダミー情報を実際の内容へ変更してから公開してください。');
  process.exitCode = 1;
} else {
  console.log('Claude Codeへ「未設定項目を順番に案内して」と伝えると更新できます。');
}
