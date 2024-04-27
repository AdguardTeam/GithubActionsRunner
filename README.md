# @adguard/github-actions-runner

## Description
`@adguard/github-actions-runner` is a versatile command-line interface (CLI) tool designed to facilitate the automation of GitHub Actions, particularly geared towards simplifying repository mirroring, command execution, and artifact management in a seamless manner. It leverages GitHub's robust API to offer a streamlined approach to running and managing GitHub workflows, making it an essential tool for developers looking to integrate GitHub Actions more deeply into their development and deployment processes.

## Installation
To get started with using `@adguard/github-actions-runner`, ensure that Node.js is installed on your system, and then you can install the package via:

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
Usage: github-actions-runner run-action [options]

Triggers a GitHub Action workflow run

Options:
  -r, --repo <repo>                                repository specified as "owner/repo", e.g., "AdguardTeam/GithubActionsRunner"
  -w, --workflow <workflow>                        workflow file to trigger, e.g., "test.yml"
  -b, --branch <branch>                            branch name
  -c, --rev <revision>                             commit revision
  -a, --artifacts-path [artifacts-path]            local path for downloading artifacts; if not specified, artifacts will not be downloaded
  --commit-timeout [timeout-sec]                   timeout in seconds to wait for the commit to appear in the repository (default: 300 seconds)
  --branch-timeout [timeout-sec]                   timeout in seconds to wait for the branch to appear in the repository (default: 300 seconds)
  --workflow-run-creation-timeout [timeout-sec]    timeout in seconds to wait for the workflow run to be created (default: 300 seconds)
  --workflow-run-completion-timeout [timeout-sec]  timeout in seconds to wait for the workflow run to be completed (default: 300 seconds)
  -v, --verbose                                    enable verbose mode (default: false)
  -h, --help                                       display help for command
```

### Note:
Ensure that you have a valid `GITHUB_TOKEN` set in your environment variables for authentication.

### Example:
To run a GitHub Action workflow with the specified configuration:

```
github-actions-runner run-action \
  --repo "AdguardTeam/GithubActionsRunner" \
  --workflow "build.yml" \
  --branch "master" \
  --rev "abc1234" \
  --artifacts-path "./downloads" \
  --commit-timeout 300 \
  --branch-timeout 300 \
  --verbose
```

### Docker
This CLI tool is available as a Docker image, enabling its use in containerized environments. There are two Docker images available, each serving different use cases.

#### Standard Docker Image
The standard Docker image includes an `ENTRYPOINT` to simplify command execution. You can pull it from the GitHub Container Registry and run it like this:

```bash
docker pull ghcr.io/adguard/github-actions-runner:latest
```

To run the image, use the following command:

```bash
docker run --rm -it ghcr.io/adguard/github-actions-runner:latest run-action \
  --repo "AdguardTeam/GithubActionsRunner" \
  --workflow "build.yml" \
  --branch "master" \
  --rev "abc1234" \
  --artifacts-path "./downloads" \
  --commit-timeout 300 \
  --branch-timeout 300 \
  --verbose
```

#### Docker Image without ENTRYPOINT
This alternative Docker image doesn't set an `ENTRYPOINT`, providing more flexibility for advanced use cases. Pull it from the GitHub Container Registry and run it like this:

```bash
docker pull ghcr.io/adguard/github-actions-runner:latest-ci
```

To run the image, you need to specify the command manually:

```bash
docker run --rm -it ghcr.io/adguard/github-actions-runner:latest-ci /bin/sh
```

In this mode, you can execute commands manually inside the container or create custom entry points for specific workflows.

## Contributing
Contributions to extend the functionality or improve the tool are welcome. Please refer to the project's repository on GitHub to submit issues or pull requests.
