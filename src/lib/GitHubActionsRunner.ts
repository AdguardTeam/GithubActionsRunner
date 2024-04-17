import { GithubApiClient } from './github/GithubApiClient';
import { GithubApiManager } from './github/GithubApiManager';
import { logger, setLoggerLevel } from './utils/logger';

/**
 * GitHub actions runner options.
 */
interface GitHubActionsRunnerOptions {
    /**
     * GitHub authentication token.
     */
    token: string;
    /**
     * Repository owner.
     */
    owner: string;
    /**
     * Repository name.
     */
    repo: string;
    /**
     * Verbose mode.
     */
    verbose?: boolean;
}

/**
 * Run action options.
 */
interface RunActionOptions {
    /**
     * Branch name.
     */
    branch: string;

    /**
     * Workflow name.
     */
    workflow: string;

    /**
     * Revision.
     */
    rev: string;

    /**
     * Wait for commit timeout.
     */
    commitTimeoutMs: number;

    /**
     * Wait for branch timeout.
     */
    branchTimeoutMs: number;

    /**
     * Workflow run creation timeout.
     */
    workflowRunCreationTimeoutMs: number;

    /**
     * Workflow run completion timeout.
     */
    workflowRunCompletionTimeoutMs: number;

    /**
     * Artifacts path for saving artifacts. Optional. If not provided, artifacts will not be saved.
     */
    artifactsPath?: string;
}

/**
 * GitHub actions runner.
 * This class is responsible for running GitHub actions workflows.
 */
export class GitHubActionsRunner {
    /**
     * GitHub API manager.
     * @private
     */
    private githubApiManager: GithubApiManager;

    /**
     * Repository owner.
     * @private
     */
    private readonly owner: string;

    /**
     * Repository name.
     * @private
     */
    private readonly repo: string;

    /**
     * Constructor.
     * Initializes a new instance of the GitHubActionsRunner with specified options.
     *
     * @param root0 Github action runner options.
     * @param root0.token GitHub authentication token.
     * @param root0.owner Repository owner.
     * @param root0.repo Repository name.
     * @param root0.verbose Verbose mode.
     */
    constructor({
        token,
        owner,
        repo,
        verbose,
    }: GitHubActionsRunnerOptions) {
        this.owner = owner;
        this.repo = repo;
        this.githubApiManager = new GithubApiManager(new GithubApiClient(token, owner, repo));
        if (verbose) {
            setLoggerLevel('debug');
        }
    }

    /**
     * Run action. This method triggers a GitHub action workflow and waits for its completion.
     * It also waits for the commit and branch to be available.
     * If artifactsPath is provided, it downloads the artifacts to the specified path.
     *
     * @param root0 Run action options.
     * @param root0.branch Branch name.
     * @param root0.workflow Workflow name.
     * @param root0.rev Revision.
     * @param root0.artifactsPath Artifacts path for saving artifacts. Optional. If not provided,
     * artifacts will not be saved.
     * @param root0.commitTimeoutMs Wait for commit timeout.
     * @param root0.branchTimeoutMs Wait for branch timeout.
     * @param root0.workflowRunCreationTimeoutMs Wait for workflow run creation timeout.
     * @param root0.workflowRunCompletionTimeoutMs Wait for workflow run completion timeout.
     * @returns A promise that resolves when the action is completed.
     * @throws Error if something went wrong.
     */
    async runAction({
        branch,
        workflow,
        rev,
        artifactsPath,
        commitTimeoutMs,
        branchTimeoutMs,
        workflowRunCreationTimeoutMs,
        workflowRunCompletionTimeoutMs,
    }: RunActionOptions): Promise<void> {
        logger.info(`Starting action for repository "${this.owner}/${this.repo}"`);
        logger.info(`Workflow: "${workflow}"`);
        logger.info(`Revision: "${rev}"`);
        logger.info(`Branch: "${branch}"`);
        logger.info(`Artifacts path: "${artifactsPath}"`);

        // TODO wait for the tag, not sure if we need this
        await this.githubApiManager.waitForCommit(rev, commitTimeoutMs);
        await this.githubApiManager.waitForBranch(branch, branchTimeoutMs);

        const customWorkflowRunId = await this.githubApiManager.triggerWorkflow(workflow, branch);
        await this.githubApiManager.waitForWorkflowRunCreation(
            branch,
            customWorkflowRunId,
            workflowRunCreationTimeoutMs,
        );
        const workflowRun = await this.githubApiManager.waitForWorkflowRunCompletion(
            branch,
            customWorkflowRunId,
            workflowRunCompletionTimeoutMs,
        );

        if (!workflowRun) {
            throw new Error('Workflow run not found.');
        }

        if (artifactsPath) {
            await this.githubApiManager.downloadArtifacts(workflowRun, artifactsPath);
        }
    }
}
