'use strict';

const lintLib = require('@commitlint/lint');
const defaultConfig = require('@commitlint/config-conventional');
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

const lint = lintLib.default;
const defaultConfigRules = defaultConfig.rules;

const validEvent = ['pull_request'];

async function run() {
  try {
    const token = core.getInput('token', { required: true });

    // load rules from file, if there
    const configPath = core.getInput('config_path', { required: true });
    // relative to dist/index.js
    const filename = path.join(__dirname, '/../', configPath);
    const config = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
    const fileRules = config.rules || {};

    // load raw rules from action, if there
    const rulesRaw = core.getInput('rules');
    const rules = rulesRaw ? JSON.parse(rulesRaw) : {};

    const ruleSet = {
      ...defaultConfigRules,
      ...fileRules,
      ...rules,
    };

    const octokit = new github.getOctokit(token);

    const {
      eventName,
      payload: {
        repository: repo,
        pull_request: pr,
      },
    } = github.context;

    if (validEvent.indexOf(eventName) < 0) {
      core.error(`Invalid event: ${eventName}`);
      return;
    }

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
        report.errors.forEach((err) => {
          core.error(`Rule '${err.name}': ${err.message} ("${commit.message}")`);
          countErrors++;
        });
        report.warnings.forEach((err) => {
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
