# Branch Protection Setup (UI Smoke Required)

Use this guide to block merges unless UI smoke checks pass.

## Required Check Name

After this repo's workflow update, the check context to require is:

UI Smoke CI / required-ui-smoke

## GitHub UI Setup (Recommended)

1. Open GitHub repository settings.
2. Go to Settings -> Branches.
3. Add or edit a protection rule for main (and master if used).
4. Enable Require status checks to pass before merging.
5. Enable Require branches to be up to date before merging.
6. In required checks, add/select:
   UI Smoke CI / required-ui-smoke
7. Save the rule.

Result: pull requests cannot be merged until UI smoke passes.

## Ruleset Alternative (Organization/Enterprise)

If you use Rulesets:

1. Settings -> Rules -> Rulesets -> New branch ruleset.
2. Target branch pattern: main (and/or master).
3. Enable Require status checks to pass.
4. Add required check:
   UI Smoke CI / required-ui-smoke
5. Set enforcement status to Active.

## Optional gh CLI Example

If you prefer CLI and have admin access/token, use GitHub's branch protection API and include this check context:

UI Smoke CI / required-ui-smoke

Tip: exact payload shape varies by existing settings and repo policy; use this guide's check name as the required context in your current branch protection JSON.

## One-Command Automation (No UI Clicking)

You can apply protection from this repo with one command.

PowerShell:

```powershell
$env:GITHUB_REPOSITORY = 'owner/repo'
$env:GITHUB_TOKEN = '<token-with-repo-admin-permission>'
$env:PROTECT_BRANCHES = 'main,master'
npm run protect:ui-smoke
```

Optional env vars:

- REQUIRED_CHECK: defaults to UI Smoke CI / required-ui-smoke
- PROTECT_BRANCHES: comma-separated branch list, defaults to main,master

This command updates existing required status checks if branch protection already exists, or creates baseline branch protection with the required UI smoke check if missing.

## First-Time GitHub Repo Bootstrap (Create + Push + Protect)

If no GitHub repository exists yet, run this once to create it and apply protection automatically:

PowerShell:

```powershell
$env:GITHUB_TOKEN = '<token-with-repo-admin-permission>'
$env:REPO_SLUG = 'owner/repo'
$env:GITHUB_REPO_PRIVATE = 'true'
npm run repo:bootstrap
```

Note: if package.json has a real GitHub repository URL, REPO_SLUG can be omitted.

What this does:

1. Initializes local git repo if missing.
2. Creates initial commit (if no commits yet).
3. Creates GitHub repo (or reuses existing one).
4. Adds/updates origin remote and pushes current branch.
5. Applies required check: UI Smoke CI / required-ui-smoke

If initial commit fails due to git identity, set:

```powershell
git config user.name 'Your Name'
git config user.email 'you@example.com'
```

## Verification

1. Open a test pull request.
2. Ensure UI Smoke CI runs.
3. Confirm merge button stays blocked while check is pending/failing.
4. Confirm merge becomes available only after UI Smoke CI / required-ui-smoke passes.
