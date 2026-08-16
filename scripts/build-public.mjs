import { copyFile, lstat, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staging = join(root, '.dist-build');
const output = join(root, 'dist');

const requiredFiles = [
  '_headers',
  '404.html',
  'index.html',
  'mobile.html',
  'services.html',
  'about.html',
  'contact.html',
  'privacy.html',
  'legal.html',
  'lp-world.css',
  'lp-world.js',
  'space-experience.css',
  'space-experience.js',
  'site.css',
  'site.js',
  'style.css',
  'assets/profile-placeholder.jpg',
  'assets/og-space.jpg',
  'assets/images/page-hero-nature.jpg',
  'assets/images/product-brush-sakura.png',
  'assets/images/product-brush-purple.png',
  'assets/images/product-brush-ocean.png',
  'assets/images/home-sphere-desktop.png',
  'assets/images/home-sphere-mobile.png',
  'assets/posters/scene-thinking.jpg',
  'assets/posters/scene-sales.jpg',
  'assets/posters/scene-beauty.jpg',
  'assets/vendor/three.module.min.js',
  'assets/docs/teamcreative-dx.pdf',
  'data/faq.json',
];

const optionalFiles = [
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  'assets/videos/desktop/01-hero-intro.mp4',
  'assets/videos/desktop/01-hero-intro.webm',
  'assets/videos/desktop/02-ai-training.mp4',
  'assets/videos/desktop/02-ai-training.webm',
  'assets/videos/desktop/03-automation-flow.mp4',
  'assets/videos/desktop/03-automation-flow.webm',
  'assets/videos/desktop/04-development.mp4',
  'assets/videos/desktop/04-development.webm',
  'assets/videos/mobile/01-hero-intro.mp4',
  'assets/videos/mobile/01-hero-intro.webm',
  'assets/videos/mobile/02-ai-training.mp4',
  'assets/videos/mobile/02-ai-training.webm',
  'assets/videos/mobile/03-automation-flow.mp4',
  'assets/videos/mobile/03-automation-flow.webm',
  'assets/videos/mobile/04-development.mp4',
  'assets/videos/mobile/04-development.webm',
];

const forbiddenPrefixes = [
  '.agents/',
  '.claude/',
  '.codex/',
  '.git/',
  '.wrangler/',
  'admin/',
  'output/',
  'scripts/',
  'tmp/',
];

const forbiddenFiles = new Set([
  '.DS_Store',
  '_redirects',
]);

const allowedEmails = new Set(['contact@example.com']);
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['OpenAI-style key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
];

const textExtensions = new Set([
  '', '.css', '.html', '.js', '.json', '.md', '.svg', '.txt', '.xml',
]);

async function copyPublicFile(path, required) {
  const source = join(root, path);
  let sourceStat;

  try {
    sourceStat = await lstat(source);
  } catch (error) {
    if (!required && error.code === 'ENOENT') return false;
    throw new Error(`Required public file is missing: ${path}`);
  }

  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error(`Public entry must be a regular file: ${path}`);
  }

  const destination = join(staging, path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return true;
}

async function listStagedFiles(directory = staging) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listStagedFiles(fullPath));
    if (entry.isFile()) files.push(relative(staging, fullPath));
  }

  return files;
}

function assertAllowedPath(path) {
  if (forbiddenFiles.has(path) || forbiddenPrefixes.some(prefix => path.startsWith(prefix))) {
    throw new Error(`Forbidden path reached public output: ${path}`);
  }
}

function scanText(path, contents) {
  const emails = contents.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  for (const email of emails) {
    if (!allowedEmails.has(email.toLowerCase())) {
      throw new Error(`Non-dummy email detected in public output: ${path}`);
    }
  }

  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(contents)) {
      throw new Error(`${label} pattern detected in public output: ${path}`);
    }
  }
}

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });

for (const path of requiredFiles) await copyPublicFile(path, true);
for (const path of optionalFiles) await copyPublicFile(path, false);

const stagedFiles = (await listStagedFiles()).sort();
for (const path of stagedFiles) {
  assertAllowedPath(path);
  if (!textExtensions.has(extname(path).toLowerCase())) continue;
  scanText(path, await readFile(join(staging, path), 'utf8'));
}

await rm(output, { recursive: true, force: true });
await rename(staging, output);

console.log(`Public build ready: dist (${stagedFiles.length} files)`);
