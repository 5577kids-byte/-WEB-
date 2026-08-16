import { spawnSync } from 'node:child_process';

const secretPatterns = [
  {
    label: 'private key marker',
    pattern: '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    isPlaceholder: () => false,
    failOnCandidate: true,
  },
  {
    label: 'GitHub token',
    pattern: '\\bgh[pousr]_[A-Za-z0-9]{20,}\\b',
    isPlaceholder: value => /^gh[pousr]_x+$/i.test(value),
    failOnCandidate: true,
  },
  {
    label: 'OpenAI-style key',
    pattern: '\\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\\b',
    isPlaceholder: value => /^sk-(?:proj-)?x+$/i.test(value),
    failOnCandidate: true,
  },
  {
    label: 'AWS access key',
    pattern: '\\b(?:AKIA|ASIA)[A-Z0-9]{16}\\b',
    isPlaceholder: value => /^(?:AKIA|ASIA)X+$/i.test(value),
    failOnCandidate: true,
  },
  {
    label: 'Google API key',
    pattern: '\\bAIza[0-9A-Za-z_-]{35}\\b',
    isPlaceholder: value => /^AIzaX+$/i.test(value),
    failOnCandidate: true,
  },
  {
    label: 'Slack token',
    pattern: '\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b',
    isPlaceholder: value => /^xox[baprs]-x+$/i.test(value),
    failOnCandidate: true,
  },
  {
    label: 'client-side password assignment',
    pattern: "(?i)\\bpassword\\s*[:=]\\s*['\"][^'\"]{6,}['\"]",
    isPlaceholder: value => /(change|dummy|example|replace|test|your|x{4,})/i.test(value),
    failOnCandidate: false,
  },
];

function runGit(args, allowNoMatch = false) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  if (allowNoMatch && result.status === 1) return '';
  if (result.status !== 0) {
    throw new Error(`Git command failed while auditing history (exit ${result.status}).`);
  }

  return result.stdout;
}

function grepCommit(commit, pattern, ignoreCase = false) {
  const args = ['grep', '-I', '-P', '-o'];
  if (ignoreCase) args.push('-i');
  args.push('-e', pattern, commit, '--');
  return runGit(args, true);
}

function parseMatches(output) {
  const matches = [];

  for (const line of output.split('\n')) {
    if (!line) continue;
    const firstSeparator = line.indexOf(':');
    const secondSeparator = line.indexOf(':', firstSeparator + 1);
    if (firstSeparator < 0 || secondSeparator < 0) continue;
    matches.push({
      file: line.slice(firstSeparator + 1, secondSeparator),
      value: line.slice(secondSeparator + 1),
    });
  }

  return matches;
}

function isDummyEmail(email) {
  const normalized = email.toLowerCase();
  return normalized === 'contact@example.com'
    || normalized.endsWith('@example.com')
    || normalized.endsWith('@users.noreply.github.com');
}

const commits = runGit(['rev-list', '--all']).trim().split('\n').filter(Boolean);
let blockingCandidates = 0;

console.log(`History commits scanned: ${commits.length}`);

for (const definition of secretPatterns) {
  const candidates = new Set();
  const placeholders = new Set();
  const files = new Set();

  for (const commit of commits) {
    const matches = parseMatches(grepCommit(commit, definition.pattern));
    for (const match of matches) {
      files.add(match.file);
      if (definition.isPlaceholder(match.value)) placeholders.add(match.value);
      else candidates.add(match.value);
    }
  }

  if (definition.failOnCandidate) blockingCandidates += candidates.size;
  const fileSummary = files.size ? [...files].sort().join(', ') : 'none';
  console.log(
    `${definition.label}: candidates=${candidates.size}, placeholders=${placeholders.size}, files=${fileSummary}`,
  );
}

const contentEmails = new Set();
const emailFiles = new Set();
const emailPattern = '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b';

for (const commit of commits) {
  const matches = parseMatches(grepCommit(commit, emailPattern, true));
  for (const match of matches) {
    if (isDummyEmail(match.value)) continue;
    contentEmails.add(match.value.toLowerCase());
    emailFiles.add(match.file);
  }
}

const authorEmails = new Set(
  runGit(['log', '--all', '--format=%ae'])
    .split('\n')
    .map(value => value.trim().toLowerCase())
    .filter(value => value && !isDummyEmail(value)),
);

console.log(
  `historical content emails: identities=${contentEmails.size}, files=${emailFiles.size ? [...emailFiles].sort().join(', ') : 'none'}`,
);
console.log(`historical author emails: identities=${authorEmails.size}`);

if (blockingCandidates > 0) {
  console.error(`History audit failed: ${blockingCandidates} high-confidence secret candidate(s).`);
  process.exitCode = 1;
} else {
  console.log('History audit passed: no high-confidence key material detected.');
}
