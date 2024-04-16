import { GithubApiClient } from './github/GithubApiClient';
import { GithubApiManager } from './github/GithubApiManager';
import { logger } from './utils/logger';

interface GitHubActionsRunnerOptions {
    token: string;
    owner: string;
    repo: string;
}

/**
 *
 */
export class GitHubActionsRunner {
    private githubApiManager: GithubApiManager;

    private readonly owner: string;

    private readonly repo: string;

    /**
     *
     * @param token
     * @param owner
     * @param repo
     */
    constructor({ token, owner, repo }: GitHubActionsRunnerOptions) {
        this.owner = owner;
        this.repo = repo;
        this.githubApiManager = new GithubApiManager(new GithubApiClient(token, owner, repo));
    }

    /**
     *
     * @param owner
     * @param branch
     */
    async runAction({
        branch,
        workflow,
        rev,
        artifactsPath,
    }: {
        branch: string;
        workflow: string;
        rev: string
        artifactsPath?: string,
    }): Promise<void> {
        logger.info(`Starting action for repository "${this.owner}/${this.repo}"`);
        logger.info(`Workflow: "${workflow}"`);
        logger.info(`Revision: "${rev}"`);
        logger.info(`Branch: "${branch}"`);
        logger.info(`Artifacts path: "${artifactsPath}"`);

        // TODO wait for the tag, not sure if we need this
        await this.githubApiManager.waitForCommit(rev);
        await this.githubApiManager.waitForBranch(branch);

        const customWorkflowRunId = await this.githubApiManager.triggerWorkflow(workflow, branch);
        await this.githubApiManager.waitForWorkflowRunCreation(branch, customWorkflowRunId);
        const workflowRun = await this.githubApiManager.waitForWorkflowRunCompletion(branch, customWorkflowRunId);

        if (!workflowRun) {
            throw new Error('Workflow run not found.');
        }

        if (artifactsPath) {
            await this.githubApiManager.downloadArtifacts(workflowRun, artifactsPath);
        }
    }
}
