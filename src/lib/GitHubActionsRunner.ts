import { GithubApiClient } from './github/GithubApiClient';
import { GithubApiManager, WORKFLOW_RUN_SUCCESSFUL_CONCLUSION_STATUS } from './github/GithubApiManager';
import { logger, setLoggerLevel } from './utils/logger';

/**
 * GitHub actions runner options.
 */
interface GitHubActionsRunnerOptions {
    /**
     * GitHub's authentication token.
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
     * The name of the branch on which the GitHub Action workflow will run.
     */
    branch: string;

    /**
     * The name of the GitHub Action workflow file to trigger (e.g., "test.yml").
     */
    workflow: string;

    /**
     * The commit revision to be used in the GitHub Action workflow.
     */
    rev: string;

    /**
     * Timeout in milliseconds to wait for the specified commit revision to appear in the repository.
     */
    commitTimeoutMs: number;

    /**
     * Timeout in milliseconds to wait for the specified branch to appear in the repository.
     */
    branchTimeoutMs: number;

    /**
     * Timeout in milliseconds to wait for the workflow run to be created after triggering.
     */
    workflowRunCreationTimeoutMs: number;

    /**
     * Timeout in milliseconds to wait for the workflow run to complete.
     */
    workflowRunCompletionTimeoutMs: number;

    /**
     * Optional path to download artifacts from the workflow. If not specified, artifacts won't be saved.
     */
    artifactsPath?: string;

    /**
     * Optional array of secret key-value pairs to pass to the workflow. Each pair should be formatted as "KEY=VALUE".
     */
    secrets: string[];

    /**
     * Optional flag to sync secrets.
     * If true, it will sync secrets with the repository and remove any secrets that are not in the provided list.
     */
    syncSecrets?: boolean;
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
     * @param root0.secrets Secrets to pass to the action.
     * @param root0.syncSecrets Sync secrets with the repository.
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
        secrets,
        syncSecrets,
    }: RunActionOptions): Promise<void> {
        logger.info(`Starting action for repository "${this.owner}/${this.repo}"`);
        logger.info(`Workflow: "${workflow}"`);
        logger.info(`Revision: "${rev}"`);
        logger.info(`Branch: "${branch}"`);
        logger.info(`Artifacts path: "${artifactsPath}"`);

        // TODO wait for the tag, not sure if we need this
        await this.githubApiManager.waitForCommit(rev, commitTimeoutMs);
        await this.githubApiManager.waitForBranch(branch, branchTimeoutMs);

        await this.githubApiManager.setSecrets(secrets, syncSecrets);

        const customWorkflowRunId = await this.githubApiManager.triggerWorkflow(workflow, branch);
        const workflowRunInfo = await this.githubApiManager.waitForWorkflowRunCreation(
            branch,
            customWorkflowRunId,
            workflowRunCreationTimeoutMs,
        );

        if (!workflowRunInfo) {
            throw new Error('Workflow run not found.');
        }

        logger.info(`Link to workflow run: "${workflowRunInfo.html_url}"`);

        const workflowRun = await this.githubApiManager.waitForWorkflowRunCompletion(
            branch,
            customWorkflowRunId,
            workflowRunCompletionTimeoutMs,
        );

        if (!workflowRun) {
            throw new Error('Workflow run not found.');
        }

        const logs = await this.githubApiManager.fetchWorkflowRunLogs(workflowRun.id);
        logger.info(logs);

        if (workflowRun.conclusion !== WORKFLOW_RUN_SUCCESSFUL_CONCLUSION_STATUS) {
            throw new Error(`Workflow run failed with conclusion: "${workflowRun.conclusion}".`);
        }

        if (artifactsPath) {
            // if no artifacts are found, the method will throw an error
            await this.githubApiManager.downloadArtifacts(workflowRun, artifactsPath);
        }
    }
}
