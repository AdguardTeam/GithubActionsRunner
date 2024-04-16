# @adguard/github-actions-runner

## Description
`@adguard/github-actions-runner` is a versatile command-line interface (CLI) tool designed to facilitate the automation of GitHub Actions, particularly geared towards simplifying repository mirroring, command execution, and artifact management in a seamless manner. It leverages GitHub's robust API to offer a streamlined approach to running and managing GitHub workflows, making it an essential tool for developers looking to integrate GitHub Actions more deeply into their development and deployment processes.

## Installation
To get started with using `@adguard/github-actions-runner`, ensure that Node.js is installed on your system, and then you can install the package via 

pnpm:
```bash
pnpm install @adguard/github-actions-runner
```

npm:
```bash
npm install @adguard/github-actions-runner
```

or yarn:
```bash
yarn add @adguard/github-actions-runner
```

## Usage
The CLI tool can be used to trigger and manage GitHub Actions with the following command format:

```bash
Usage: @adguard/github-actions-runner run-action [options]

Triggers a GitHub Action workflow run

Options:
  --repo <repo>                     The repository name in the format owner/repo
  --workflow <workflow>             Workflow filename to trigger. Example: test.yml
  --branch <branch>                 The branch name
  --rev <revision>                  The commit revision
  --artifacts-path <artifactsPath>  The local path to download artifacts to
  -h, --help                        display help for command
```

### Note:
Ensure that you have a valid GITHUB_TOKEN set in your environment variables for authentication.

### Example:
To run a GitHub Action workflow with the specified configuration:

```
github-actions-runner run-action \
--repo="adguard/github-actions-runner" \
--workflow="build.yml" \
--branch="master" \
--rev="abc1234" \
--artifacts-path="./downloads"
```

## Contributing
Contributions to extend the functionality or improve the tool are welcome. Please refer to the project's repository on GitHub to submit issues or pull requests.
