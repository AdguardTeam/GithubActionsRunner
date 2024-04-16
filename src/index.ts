// FIXME:
// - README.md
// - CI/CD
// - timeout for the action
// - description in the packages.json
// - changelog
// - github workflow
// - docker image
// - add verbose flag and logger, which will log the requests and responses

import { Command } from 'commander';
import { GitHubActionsRunner } from './GitHubActionsRunner';
import packageJson from '../package.json';

import 'dotenv/config';
import { logger } from './utils/logger';

const program = new Command();

program
    .name(packageJson.name)
    .description('CLI to run and manage GitHub Actions')
    .version(packageJson.version);

program.command('run-action')
    .description('Trigger a GitHub Action workflow run')
    .requiredOption('--repo <repo>', 'The repository name in the format owner/repo')
    .requiredOption('--workflow <workflow>', 'Workflow filename to trigger. Example: test.yml')
    .requiredOption('--branch <branch>', 'The branch name')
    .requiredOption('--rev <revision>', 'The commit revision')
    .option('--artifacts-path <artifactsPath>', 'The local path to download artifacts to')
    .action(async (options) => {
        const {
            repo,
            workflow,
            branch,
            rev,
            artifactsPath,
        } = options;
        const [owner, repoName] = repo.split('/');
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            logger.error('<GITHUB_TOKEN> environment variable is required');
            process.exit(1);
        }

        const runner = new GitHubActionsRunner({ token, owner, repo: repoName });

        try {
            await runner.runAction({
                branch,
                workflow,
                rev,
                artifactsPath,
            });
        } catch (e) {
            logger.error(e);
            process.exit(1);
        }
    });

program.parse(process.argv);
