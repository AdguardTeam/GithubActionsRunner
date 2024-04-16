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
github-actions-runner run-action \
--repo="<owner/repo>" \
--workflow="<workflow_file.yml>" \
--branch="<branch_name>" \
--rev="<commit_revision>" \
--artifacts-path="<path_to_download_artifacts>"
```

### Parameters:
`--repo`: Specifies the GitHub repository in the format "owner/repo".
`--workflow`: The workflow file to trigger (e.g., build.yml).
`--branch`: The branch name to run the workflow against.
`--rev`: The specific commit revision.
`--artifacts-path`: (Optional) The local path to download the artifacts to.

### Note:
Ensure that you have a valid GITHUB_TOKEN set in your environment variables for authentication.

### Example:
To run a GitHub Action workflow with the specified configuration:

```
github-actions-runner run-action \
--repo="adguard/github-actions-runner" \
--workflow="build.yml" \
--branch="main" \
--rev="abc1234" \
--artifacts-path="./downloads"
```

## Contributing
Contributions to extend the functionality or improve the tool are welcome. Please refer to the project's repository on GitHub to submit issues or pull requests.
