![Prcolinter](https://github.com/matmar10/prcolinter/blob/master/logo.png?raw=true "Percolinter PR Conventional Commit Linter")

Easily lint _each_ commit for your PRs against the [Conventional Commit](https://www.conventionalcommits.org/) spec based on [configurable Linter rules](https://github.com/conventional-changelog/commitlint/blob/master/docs/reference-rules.md).

**Brew up a stronger commit history!**

## Quick Start

```yaml
name: Conventional Commit

on:
  pull_request:
    branches: [ '*' ]

jobs:
  lint-commits:
    steps:
      - uses: actions/checkout@v2
      - uses: matmar10/prcolinter@1.2.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

## Custom rules

By default, it uses [@commitlint/config-conventional](https://github.com/conventional-changelog/commitlint/blob/master/@commitlint/config-conventional/index.js) rules.

Add a JSON file under `.github/prcolinterrc.json` to define your customer rules:

```json
{
  "rules": {
    "body-max-line-length": [2, "always", 300],
  }  
}
```

-- or --

You can use or customize any of the [Commitlint rules listed here](https://github.com/conventional-changelog/commitlint/blob/master/docs/reference-rules.md)

You can also define custom rules inline:

```yaml
name: Conventional Commit

on:
  pull_request:
    branches: [ '*' ]

jobs:
  lint-commits:
    steps:
      - uses: actions/checkout@v2
      - uses: matmar10/prcolinter@1.2.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          # NOTE: the use of a string, not an object because github doesn't support objects as args
          rules: '{"body-max-line-length": [2, "always", 300]}'
```

## Debug

You can see verbose log output by adding a Github secret on `ACTIONS_STEP_DEBUG` to `true`
