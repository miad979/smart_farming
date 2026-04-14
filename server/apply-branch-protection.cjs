const REQUIRED_CHECK = process.env.REQUIRED_CHECK || 'required-ui-smoke';
const REPO_SLUG = process.env.GITHUB_REPOSITORY || process.env.REPO_SLUG || '';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const APPEND_EXISTING_CONTEXTS = String(process.env.APPEND_EXISTING_CONTEXTS || 'false').toLowerCase() === 'true';
const BRANCHES = String(process.env.PROTECT_BRANCHES || 'main')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!REPO_SLUG || !REPO_SLUG.includes('/')) {
  fail('Missing GITHUB_REPOSITORY (owner/repo) or REPO_SLUG environment variable.');
}

if (!TOKEN) {
  fail('Missing GITHUB_TOKEN or GH_TOKEN environment variable.');
}

const [owner, repo] = REPO_SLUG.split('/');
if (!owner || !repo) {
  fail(`Invalid repository slug: ${REPO_SLUG}`);
}

async function ghRequest(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'smart-farming-branch-protection-script',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let json = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  return { ok: response.ok, status: response.status, json };
}

function uniqueContexts(contexts) {
  return [...new Set((contexts || []).filter(Boolean))];
}

async function ensureRequiredCheck(branch) {
  const branchPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`;
  const branchInfo = await ghRequest(branchPath);
  if (!branchInfo.ok) {
    if (branchInfo.status === 404) {
      console.log(`Skipping '${branch}': branch not found.`);
      return { branch, skipped: true, reason: 'branch-not-found' };
    }
    throw new Error(`Cannot read branch '${branch}' (${branchInfo.status}): ${branchInfo.json?.message || 'Unknown error'}`);
  }

  const requiredStatusPath = `${branchPath}/protection/required_status_checks`;
  const currentRequired = await ghRequest(requiredStatusPath);

  let existingContexts = [];
  if (currentRequired.ok) {
    existingContexts = uniqueContexts([
      ...(currentRequired.json?.contexts || []),
      ...((currentRequired.json?.checks || []).map((check) => check?.context).filter(Boolean)),
    ]);
  }

  const targetContexts = APPEND_EXISTING_CONTEXTS
    ? uniqueContexts([...existingContexts, REQUIRED_CHECK])
    : uniqueContexts([REQUIRED_CHECK]);

  if (currentRequired.ok) {
    const updateRequired = await ghRequest(requiredStatusPath, {
      method: 'PATCH',
      body: {
        strict: true,
        contexts: targetContexts,
      },
    });

    if (!updateRequired.ok) {
      throw new Error(
        `Failed updating required status checks on '${branch}' (${updateRequired.status}): ${updateRequired.json?.message || 'Unknown error'}`,
      );
    }

    console.log(`Updated required status checks on '${branch}' with context '${REQUIRED_CHECK}'.`);
    return { branch, updated: true, method: 'patch-required-status' };
  }

  if (currentRequired.status !== 404) {
    throw new Error(
      `Cannot read required status checks for '${branch}' (${currentRequired.status}): ${currentRequired.json?.message || 'Unknown error'}`,
    );
  }

  const createProtection = await ghRequest(`${branchPath}/protection`, {
    method: 'PUT',
    body: {
      required_status_checks: {
        strict: true,
        contexts: targetContexts,
      },
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
    },
  });

  if (!createProtection.ok) {
    throw new Error(
      `Failed enabling branch protection on '${branch}' (${createProtection.status}): ${createProtection.json?.message || 'Unknown error'}`,
    );
  }

  console.log(`Enabled branch protection on '${branch}' with required context '${REQUIRED_CHECK}'.`);
  return { branch, updated: true, method: 'put-branch-protection' };
}

async function main() {
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Branches: ${BRANCHES.join(', ')}`);
  console.log(`Required check: ${REQUIRED_CHECK}`);

  const results = [];
  for (const branch of BRANCHES) {
    // Sequential updates keep API error reporting simple and deterministic.
    // eslint-disable-next-line no-await-in-loop
    results.push(await ensureRequiredCheck(branch));
  }

  const applied = results.filter((item) => item.updated).length;
  const skipped = results.filter((item) => item.skipped).length;
  console.log(`Done. Updated: ${applied}, Skipped: ${skipped}`);

  if (applied === 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`);
  process.exit(1);
});
