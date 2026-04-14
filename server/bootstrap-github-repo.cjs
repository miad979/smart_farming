const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const explicitSlug = process.env.REPO_SLUG || process.env.GITHUB_REPOSITORY || '';
const ownerFromEnv = process.env.GITHUB_OWNER || '';
const repoNameFromEnv = process.env.GITHUB_REPO_NAME || '';
const isPrivate = String(process.env.GITHUB_REPO_PRIVATE || 'true').toLowerCase() !== 'false';
const defaultBranch = process.env.DEFAULT_BRANCH || 'main';
const requiredCheck = process.env.REQUIRED_CHECK || 'UI Smoke CI / required-ui-smoke';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(stderr || stdout || `${command} ${args.join(' ')} failed`);
  }

  return (result.stdout || '').trim();
}

function runMaybe(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

async function ghRequest(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'smart-farming-repo-bootstrap-script',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

function resolveSlug() {
  if (explicitSlug && explicitSlug.includes('/')) return explicitSlug;

  if (ownerFromEnv && repoNameFromEnv) {
    return `${ownerFromEnv}/${repoNameFromEnv}`;
  }

  const packageSlug = readSlugFromPackageJson();
  if (packageSlug) return packageSlug;

  return '';
}

function readSlugFromPackageJson() {
  try {
    const packagePath = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) return '';

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const repository = pkg?.repository;
    const rawUrl = typeof repository === 'string' ? repository : repository?.url;
    if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return '';

    const cleaned = rawUrl.trim();
    const httpsMatch = cleaned.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (!httpsMatch) return '';

    const owner = httpsMatch[1];
    const repo = httpsMatch[2];
    if (!owner || !repo) return '';

    // Ignore placeholder metadata.
    if (owner.toLowerCase() === 'your-org') return '';

    return `${owner}/${repo}`;
  } catch {
    return '';
  }
}

function ensureGitInitialized() {
  const inside = runMaybe('git', ['rev-parse', '--is-inside-work-tree']);
  if (inside.ok && inside.stdout === 'true') {
    return;
  }

  console.log(`Initializing git repository with default branch '${defaultBranch}'...`);
  run('git', ['init', '-b', defaultBranch]);
}

function ensureInitialCommit() {
  const hasCommit = runMaybe('git', ['rev-parse', '--verify', 'HEAD']);
  if (hasCommit.ok) {
    return;
  }

  console.log('Creating initial commit...');
  run('git', ['add', '-A']);

  try {
    run('git', ['commit', '-m', 'chore: initial project import']);
  } catch (error) {
    throw new Error(
      `Initial commit failed. Configure git identity first:\n` +
      `git config user.name \"Your Name\"\n` +
      `git config user.email \"you@example.com\"\n\n` +
      `Original error: ${error.message}`,
    );
  }
}

function getCurrentBranch() {
  const branch = run('git', ['branch', '--show-current']);
  return branch || defaultBranch;
}

function ensureOriginRemote(remoteUrl) {
  const existing = runMaybe('git', ['remote', 'get-url', 'origin']);
  if (existing.ok) {
    if (existing.stdout !== remoteUrl) {
      console.log('Updating origin remote URL...');
      run('git', ['remote', 'set-url', 'origin', remoteUrl]);
    }
    return;
  }

  console.log('Adding origin remote...');
  run('git', ['remote', 'add', 'origin', remoteUrl]);
}

async function ensureRepoExists(owner, repo) {
  const check = await ghRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (check.ok) {
    console.log(`Repository already exists: ${owner}/${repo}`);
    return;
  }

  if (check.status !== 404) {
    throw new Error(`Failed checking repository (${check.status}): ${check.json?.message || 'Unknown error'}`);
  }

  const me = await ghRequest('/user');
  if (!me.ok) {
    throw new Error(`Cannot fetch authenticated user (${me.status}): ${me.json?.message || 'Unknown error'}`);
  }

  const login = String(me.json?.login || '');
  if (!login) {
    throw new Error('Authenticated user login is empty.');
  }

  const creatingInOwnAccount = owner.toLowerCase() === login.toLowerCase();
  const path = creatingInOwnAccount
    ? '/user/repos'
    : `/orgs/${encodeURIComponent(owner)}/repos`;

  const create = await ghRequest(path, {
    method: 'POST',
    body: {
      name: repo,
      private: isPrivate,
      auto_init: false,
      has_issues: true,
      has_projects: true,
      has_wiki: false,
    },
  });

  if (!create.ok && create.status !== 422) {
    throw new Error(`Repository create failed (${create.status}): ${create.json?.message || 'Unknown error'}`);
  }

  if (create.status === 422) {
    console.log(`Repository may already exist or is not creatable with current token: ${owner}/${repo}`);
  } else {
    console.log(`Created repository: ${owner}/${repo}`);
  }
}

function pushBranch(branch) {
  console.log(`Pushing '${branch}' to origin...`);
  run('git', ['push', '-u', 'origin', branch]);
}

function applyBranchProtection(slug) {
  console.log('Applying required UI smoke branch protection...');
  run('node', ['server/apply-branch-protection.cjs'], {
    env: {
      ...process.env,
      GITHUB_REPOSITORY: slug,
      REQUIRED_CHECK: requiredCheck,
    },
  });
}

async function main() {
  const slug = resolveSlug();
  if (!slug) {
    fail('Missing target repository slug. Set REPO_SLUG or GITHUB_REPOSITORY, or set GITHUB_OWNER + GITHUB_REPO_NAME.');
  }

  if (!TOKEN) {
    fail('Missing GITHUB_TOKEN or GH_TOKEN environment variable.');
  }

  if (!slug.includes('/')) {
    fail(`Invalid repository slug: ${slug}`);
  }

  const [owner, repo] = slug.split('/');
  if (!owner || !repo) {
    fail(`Invalid repository slug: ${slug}`);
  }

  console.log(`Target repository: ${owner}/${repo}`);
  console.log(`Private repo: ${isPrivate}`);

  ensureGitInitialized();
  ensureInitialCommit();

  await ensureRepoExists(owner, repo);

  const remoteUrl = `https://github.com/${owner}/${repo}.git`;
  ensureOriginRemote(remoteUrl);

  const branch = getCurrentBranch();
  pushBranch(branch);
  applyBranchProtection(`${owner}/${repo}`);

  console.log('Done: repository bootstrapped, code pushed, and UI smoke branch protection applied.');
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`);
  process.exit(1);
});
