'use strict';

const lintLib = require('@commitlint/lint');
const defaultConfig = require('@commitlint/config-conventional');
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

const lint = lintLib.default;
const rules = config.rules;

const validEvent = ['pull_request'];

async function run() {
  try {
    const token = core.getInput('token', { required: true });{
    const configPath = core.getInput('config_path', { required: true });
    const config = fs.existsSync(configPath) ? require(configPath) : {};

    const rulesRaw = core.getInput('rules');
    const rules = rulesRaw ? JSON.parse(rulesRaw) : {};

    const octokit = new github.getOctokit(token);

    const {
      eventName,
      payload: {
        repository: repo,
        pull_request: pr
      }
    } = github.context;

    if (validEvent.indexOf(eventName) < 0) {
      core.error(`Invalid event: ${eventName}`);
      return;
    }

    const ruleSet = {
      ...defaultConfig.rules,
      ...config.rules,
      ...rules
    };

    const commits = await octokit.rest.pulls.listCommits({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: pr.number,
    });
    
    const reports = await Promise.all(commits.data.map(commit => lint(commit.commit.message, ruleSet)));
    let countErrors = 0;
    let countWarnings = 0;
    reports.forEach((report, i) => {
      const meta = commits.data[i];
      const { sha, commit } = meta;
      core.startGroup(`Commit "${commit.message}" ${sha.substring(0, 7)} (${commit.author.name} <${commit.author.email}> on ${commit.author.date})`);
      if (!report.valid) {
        report.errors.forEach(err => {
          core.error(`Rule '${err.name}': ${err.message} ("${commit.message}")`);
          countErrors++;
        });
        report.warnings.forEach(err => {
          core.warning(`Rule '${err.name}': ${err.message} ("${commit.message}")`);
          countWarnings++;
        });
      }
      core.endGroup();
    });

    if (countErrors) {
      core.setFailed(`Action failed with ${countErrors} errors (and ${countWarnings} warnings)`);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
