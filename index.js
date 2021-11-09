'use strict';

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */

const lintLib = require('@commitlint/lint');
const defaultConfig = require('@commitlint/config-conventional');
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const lint = lintLib.default;
const defaultConfigRules = defaultConfig.rules;

const validEvent = ['pull_request'];

async function run() {
  try {
    const token = core.getInput('token', { required: true });
    const createComment = core.getBooleanInput('comment');
    const deleteComment = core.getBooleanInput('delete_comment');

    // load rules from file, if there
    const configPath = core.getInput('config_path', { required: true });

    // relative to dist/index.js
    const filename = path.join(__dirname, '/../', configPath);
    core.debug(`Loading config from path: ${filename}`);
    const config = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
    core.debug(`Loaded config is: ${JSON.stringify(config)}`);
    const fileRules = config.rules || {};

    // load raw rules from action, if there
    const rulesRaw = core.getInput('rules');
    const rules = rulesRaw ? JSON.parse(rulesRaw) : {};

    const ruleSet = {
      ...defaultConfigRules,
      ...fileRules,
      ...rules,
    };
    core.debug(`Using rules: ${JSON.stringify(ruleSet)}`);

    const octokit = new github.getOctokit(token);

    const {
      eventName,
      payload: {
        repository: repo,
        pull_request: pr,
      },
      issue: {
        number: num,
      },
      repo: {
        owner,
      },
    } = github.context;

    if (validEvent.indexOf(eventName) < 0) {
      core.error(`Invalid event: ${eventName}`);
      return;
    }

    core.debug(`Fetching commits for PR #${num}...`);
    const commits = await octokit.rest.pulls.listCommits({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: pr.number,
    });

    core.debug(`Processing ${commits.data.length} commits...`);
    const reports = await Promise.all(commits.data.map(commit => lint(commit.commit.message, ruleSet)));
    let countErrors = 0;
    let countWarnings = 0;
    const authors = [];

    const commitReports = [];
    reports.forEach((report, i) => {
      const meta = commits.data[i];
      const { sha, commit } = meta;
      if (!authors.includes(commit.author.name)) {
        authors.push(commit.author.name);
      }
      const shaShort = sha.substring(0, 7);
      const relativeTime = moment(commit.author.date).fromNow();

      const msg = `Commit "${commit.message}" ${shaShort} (${commit.author.name} <${commit.author.email}> on ${commit.author.date})`;
      core.startGroup(msg);
      core.debug(msg);

      if (!meta.committer) {
        core.warning(`Commit "${commit.message}" ${shaShort} has no committer in metadata.`);
      }
      // handle missing committer due to deleted account, etc.
      const commiterInfo = meta.committer ?
        `By **[${commit.author.name} (${meta.committer.login})](https://github.com/${meta.committer.login})** _${relativeTime}_` :
        `By **${commit.author.name} (Unknown Login) _${relativeTime}_`;

      const headerIcon = report.valid ? '✅' :
        report.errors.length ? '❌' : '⚠️';
      let commitReportText = `
### ${headerIcon} [Commit ${shaShort}](https://github.com/${owner}/${repo.name}/commit/${sha})

${commiterInfo}

\`\`\`
${commit.message}
\`\`\`
`;

      if (!report.valid) {
        let errorReportText = '';
        report.errors.forEach((err) => {
          const ruleDef = ruleSet[err.name];
          core.error(`Rule '${err.name}': ${err.message} ("${commit.message}")`);
          countErrors++;
          errorReportText += `
❌ **ERROR**: ${err.message}
> ["${err.name}"](https://github.com/conventional-changelog/commitlint/blob/master/docs/reference-rules.md#${err.name}): ${JSON.stringify(ruleDef)}
`;
        });

        let warningReportText = '';
        report.warnings.forEach((err) => {
          const ruleDef = ruleSet[err.name];
          core.warning(`Rule '${err.name}': ${err.message} ("${commit.message}")`);
          countWarnings++;
          warningReportText += `
⚠️ **Warning**: ${err.message}
> ["${err.name}"](https://github.com/conventional-changelog/commitlint/blob/master/docs/reference-rules.md#${err.name}): ${JSON.stringify(ruleDef)}
`;
        });
        commitReportText += `
${errorReportText}
${warningReportText}
`;
      }
      commitReports.push(commitReportText);
      core.endGroup();
    });

    if (countErrors) {
      core.setFailed(`Action failed with ${countErrors} errors (and ${countWarnings} warnings)`);
    }

    if (deleteComment) {
      const perPage = 100;
      let page = 1;
      let hasMore = true;
      do {
        core.debug(`Fetching page #${page} (max: ${perPage}) of existing comments...`);
        const res = await octokit.rest.issues.listComments({
          owner,
          repo: repo.name,
          issue_number: num,
          per_page: 100,
          page,
        });
        const relevantComments = res.data.filter(comment => comment.body.includes('## Commit Message Lint Report'));
        core.debug(`Fetched ${relevantComments.length} relevant (previous lint report) comments...`);
        for (let i = 0; i < relevantComments.length; i++) {
          core.debug(`Deleting comment #${relevantComments[i].id}...`);
          await octokit.rest.issues.deleteComment({
            owner,
            repo: repo.name,
            comment_id: relevantComments[i].id,
          });
        }
        page++;
        if (res.data.length < perPage) {
          hasMore = false;
        }
      } while (hasMore);
    }

    if (createComment) {
      if (countErrors || countWarnings) {
        const finalReport = `
# 🚨🚔 Unconventional Commit 👮‍♀️🙅‍♂️

🤖 Beep boop! Looks like one or more of your commit messages wasn't quite right.

## Commit Message Lint Report

- ✏️  **${commits.data.length} commit(s)**
- 👤  **${authors.length} author(s)**
- ❌  **${countErrors} lint error(s)**
- ⚠️  **${countWarnings} lint warning(s)**

${commitReports.join('\n')}

## Tips

Be sure to follow the [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) guideline when authoring your commits.

If your most recent commit is to blame, you can edit a single commit with:

\`\`\`
git commit --amend
\`\`\`

To edit & merge multiple commits, you can rebase with \`git rebase -i master\` (be sure your master is up to date).
`;
        await octokit.rest.issues.createComment({
          owner,
          repo: repo.name,
          issue_number: num,
          body: finalReport,
        });
      } else {
        const finalReport = `
# ✅🙏🏻 Conventional Commit 🥳 🎉

🤖 Beep boop! Congrats, it like all your commit messages conform to the [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) spec! 👏👏👏

Your PR can be closed. Coffee is for closers, so here's a coffee for you: ☕️

## Commit Message Lint Report

- ✏️  **${commits.data.length} commit(s)**
- 👤  **${authors.length} author(s)**
- ❌  **${countErrors} lint error(s)**
- ⚠️  **${countWarnings} lint warning(s)**
`;
        await octokit.rest.issues.createComment({
          owner,
          repo: repo.name,
          issue_number: num,
          body: finalReport,
        });
      }
    }
  } catch (err) {
    console.error(err);
    core.setFailed(err.message);
  }
}

run();
