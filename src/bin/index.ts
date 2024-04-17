#!/usr/bin/env node
import { Command, Option } from 'commander';

import { GitHubActionsRunner } from '../lib/GitHubActionsRunner';
import packageJson from '../../package.json';
import { logger } from '../lib/utils/logger';
import {
    DEFAULT_WAIT_FOR_BRANCH_TIMEOUT_MS,
    DEFAULT_WAIT_FOR_COMMIT_TIMEOUT_MS,
    DEFAULT_WORKFLOW_RUN_COMPLETION_TIMEOUT_MS,
    DEFAULT_WORKFLOW_RUN_CREATION_TIMEOUT_MS,
} from '../lib/constants';

import 'dotenv/config';

const program = new Command();

program
    .name(packageJson.name.replace('@adguard/', ''))
    .description('A CLI tool for running and managing GitHub Actions workflows.')
    .version(packageJson.version);

program.command('run-action')
    .description('Triggers a GitHub Action workflow run')
    .requiredOption(
        '-r, --repo <repo>',
        'repository specified as "owner/repo", e.g., "AdguardTeam/GithubActionsRunner"',
    )
    .requiredOption('-w, --workflow <workflow>', 'workflow file to trigger, e.g., "test.yml"')
    .requiredOption('-b, --branch <branch>', 'branch name')
    .requiredOption('-v, --rev <revision>', 'commit revision')
    .option(
        '-a, --artifacts-path [artifacts-path]',
        'local path for downloading artifacts; if not specified, artifacts will not be downloaded',
    )
    .addOption(
        new Option(
            '--commit-timeout [timeout-sec]',
            'timeout in seconds to wait for the commit to appear in the repository',
        )
            .default(
                DEFAULT_WAIT_FOR_COMMIT_TIMEOUT_MS,
                `${DEFAULT_WAIT_FOR_COMMIT_TIMEOUT_MS / 1000} seconds`,
            )
            .argParser((value) => parseInt(value, 10) * 1000),
    )
    .addOption(
        new Option(
            '--branch-timeout [timeout-sec]',
            'timeout in seconds to wait for the branch to appear in the repository',
        )
            .default(
                DEFAULT_WAIT_FOR_BRANCH_TIMEOUT_MS,
                `${DEFAULT_WAIT_FOR_BRANCH_TIMEOUT_MS / 1000} seconds`,
            )
            .argParser((value) => parseInt(value, 10) * 1000),
    )
    .addOption(
        new Option(
            '--workflow-run-creation-timeout [timeout-sec]',
            'timeout in seconds to wait for the workflow run to be created',
        )
            .default(
                DEFAULT_WORKFLOW_RUN_CREATION_TIMEOUT_MS,
                `${DEFAULT_WORKFLOW_RUN_CREATION_TIMEOUT_MS / 1000} seconds`,
            )
            .argParser((value) => parseInt(value, 10) * 1000),
    )
    .addOption(
        new Option(
            '--workflow-run-completion-timeout [timeout-sec]',
            'timeout in seconds to wait for the workflow run to be completed',
        )
            .default(
                DEFAULT_WORKFLOW_RUN_COMPLETION_TIMEOUT_MS,
                `${DEFAULT_WORKFLOW_RUN_COMPLETION_TIMEOUT_MS / 1000} seconds`,
            )
            .argParser((value) => parseInt(value, 10) * 1000),
    )
    .option('-i, --verbose', 'enable verbose mode', false)
    .action(async (options) => {
        const {
            repo,
            workflow,
            branch,
            rev,
            artifactsPath,
            verbose,
            commitTimeout,
            branchTimeout,
            workflowRunCreationTimeout,
            workflowRunCompletionTimeout,
        } = options;
        const [owner, repoName] = repo.split('/');
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            logger.error('The <GITHUB_TOKEN> environment variable is required.');
            process.exit(1);
        }

        const runner = new GitHubActionsRunner({
            token,
            owner,
            repo: repoName,
            verbose,
        });

        try {
            await runner.runAction({
                branch,
                workflow,
                rev,
                artifactsPath,
                commitTimeoutMs: commitTimeout,
                branchTimeoutMs: branchTimeout,
                workflowRunCreationTimeoutMs: workflowRunCreationTimeout,
                workflowRunCompletionTimeoutMs: workflowRunCompletionTimeout,
            });
        } catch (e) {
            logger.error(e);
            process.exit(1);
        }
    });

program.parse(process.argv);
