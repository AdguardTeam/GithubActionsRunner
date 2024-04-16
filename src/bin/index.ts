#!/usr/bin/env node
import { Command } from 'commander';

import { GitHubActionsRunner } from '../lib/GitHubActionsRunner';
import packageJson from '../../package.json';
import { logger } from '../lib/utils/logger';
import { DEFAULT_WAIT_FOR_BRANCH_TIMEOUT_MS, DEFAULT_WAIT_FOR_COMMIT_TIMEOUT_MS } from '../lib/constants';

import 'dotenv/config';

const program = new Command();

program
    .name(packageJson.name)
    .description('CLI to run and manage GitHub Actions')
    .version(packageJson.version);

program.command('run-action')
    .description('Triggers a GitHub Action workflow run')
    .requiredOption('-r, --repo <repo>', 'repository name in the format "owner/repo"')
    .requiredOption('-w, --workflow <workflow>', 'workflow filename to trigger. ex: test.yml')
    .requiredOption('-b, --branch <branch>', 'branch name')
    .requiredOption('-v, --rev <revision>', 'commit revision')
    // FIXME add to README if not specified, wont download the artifacts
    .option('-a, --artifacts-path <artifacts-path>', 'local path to download artifacts to')
    .option(
        '--commit-timeout <timeout-sec>',
        'wait timeout for the commit to appear in the repository in seconds',
        (value) => parseInt(value, 10) * 1000,
        DEFAULT_WAIT_FOR_COMMIT_TIMEOUT_MS / 1000,
    )
    .option(
        '--branch-timeout <timeout-sec>',
        'wait timeout for the branch to appear in the repository in seconds',
        (value) => parseInt(value, 10) * 1000,
        DEFAULT_WAIT_FOR_BRANCH_TIMEOUT_MS / 1000,
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
        } = options;
        const [owner, repoName] = repo.split('/');
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            logger.error('<GITHUB_TOKEN> environment variable is required');
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
            });
        } catch (e) {
            logger.error(e);
            process.exit(1);
        }
    });

program.parse(process.argv);
