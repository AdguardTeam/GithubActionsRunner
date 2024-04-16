import { nanoid } from 'nanoid';
import axios from 'axios';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { ensureDir } from 'fs-extra';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { sleep } from '../utils/time/sleep';
import { isErrorWithStatus } from '../utils/errors/errors';
import { type GithubApiClient } from './GithubApiClient';
import { logger } from '../utils/logger';

type WorkflowRuns = RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']['data']['workflow_runs'];
export type WorkflowRun = WorkflowRuns[number];
type Artifacts = RestEndpointMethodTypes['actions']['listWorkflowRunArtifacts']['response']['data']['artifacts'];
export type Artifact = Artifacts[number];

export class GithubApiManager {
    private readonly githubApiClient: GithubApiClient;

    private readonly waitForBranchTimeoutMs: number;

    private readonly waitForBranchPollingIntervalMs: number;

    private readonly waitForCommitTimeoutMs: number;

    private readonly waitForCommitPollingIntervalMs: number;

    constructor(apiClient: GithubApiClient) {
        this.githubApiClient = apiClient;
        this.waitForBranchTimeoutMs = 60000;
        this.waitForBranchPollingIntervalMs = 5000;
        this.waitForCommitTimeoutMs = 60000;
        this.waitForCommitPollingIntervalMs = 5000;
    }

    /**
     /**
     * Checks if a commit exists based on its reference.
     * @param commitRef The reference for the commit.
     */
    async hasCommit(commitRef: string): Promise<boolean> {
        try {
            const response = await this.githubApiClient.getCommit(commitRef);
            return response.status === 200;
        } catch (error) {
            if (isErrorWithStatus(error) && error.status === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Waits for a commit to exist in the repository.
     * @param commitRef The reference for the commit to wait for (SHA, branch name, or tag name).
     */
    async waitForCommit(commitRef: string): Promise<void> {
        logger.info(`Waiting for commit ${commitRef}...`);
        const startTime = Date.now();

        const tryFetchCommit = async (): Promise<void> => {
            const exists = await this.hasCommit(commitRef);
            if (exists) {
                logger.info(`Commit ${commitRef} found.`);
                return;
            }

            if (Date.now() - startTime > this.waitForCommitTimeoutMs) {
                throw new Error(`Timeout waiting for commit ${commitRef}.`);
            }

            logger.debug(
                `Commit ${commitRef} not found. Retrying in ${this.waitForCommitPollingIntervalMs / 1000} seconds...`,
            );

            await sleep(this.waitForCommitPollingIntervalMs);
            await tryFetchCommit();
        };

        await tryFetchCommit();
    }

    /**
     * Checks if a branch exists.
     * @param branch The name of the branch.
     */
    async hasBranch(branch: string): Promise<boolean> {
        try {
            const response = await this.githubApiClient.getBranch(branch);
            return response.status === 200;
        } catch (error) {
            if (isErrorWithStatus(error) && error.status === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Waits for a branch to exist.
     * @param branchName The name of the branch to wait for.
     */
    async waitForBranch(branchName: string): Promise<void> {
        logger.info(`Waiting for branch "${branchName}"...`);
        const startTime = Date.now();

        const tryFetchBranch = async (): Promise<void> => {
            const exists = await this.hasBranch(branchName);
            if (exists) {
                logger.info(`Branch "${branchName}" found.`);
                return;
            }

            if (Date.now() - startTime > this.waitForBranchTimeoutMs) {
                throw new Error(`Timeout waiting for branch "${branchName}".`);
            }

            logger.debug(
                `Branch "${branchName}" not found. 
                Retrying in "${this.waitForBranchPollingIntervalMs / 1000}" seconds...`,
            );
            await sleep(this.waitForBranchPollingIntervalMs);
            await tryFetchBranch();
        };

        await tryFetchBranch();
    }

    /**
     * Triggers a workflow and returns the custom id of the workflow run.
     * @param workflow
     * @param branch
     * @returns The custom id of the workflow run.
     */
    async triggerWorkflow(workflow: string, branch: string): Promise<string> {
        logger.info(`Triggering workflow "${workflow}" on branch "${branch}"...`);

        const workflowRunCustomId = nanoid();

        logger.debug('Generated custom id for the workflow run:', workflowRunCustomId);

        const response = await this.githubApiClient.createDispatchEvent(workflow, branch, workflowRunCustomId);
        if (response.status !== 204) {
            throw new Error(`Failed to trigger workflow: ${response.status}`);
        }

        return workflowRunCustomId;
    }

    async getWorkflowRun(branch: string, customWorkflowRunId: string): Promise<WorkflowRun | null> {
        const workflowRunsResponse = await this.githubApiClient.listWorkflowRuns(branch);
        if (!workflowRunsResponse || !workflowRunsResponse.data || !workflowRunsResponse.data.workflow_runs) {
            return null;
        }

        const workflowRuns = workflowRunsResponse.data.workflow_runs;
        logger.debug('Received workflow runs:', workflowRuns.map((wr) => wr.name));

        // Using `includes` to check if the workflow run name contains the customWorkflowRunId
        const workflowRun = workflowRuns.find((run) => run.name?.includes(customWorkflowRunId));

        return workflowRun || null;
    }

    /**
     * Waits for a specific workflow run to complete with a timeoutMs.
     * @param branch The branch for the workflow run.
     * @param customWorkflowRunId The ID of the workflow run.
     * @param timeoutMs The maximum time to wait in milliseconds.
     * @param intervalMs The intervalMs between checks in milliseconds.
     */
    async waitForWorkflowRunCreation(
        branch: string,
        customWorkflowRunId: string,
        timeoutMs: number = 3000000, // FIXME move to the configuration
        intervalMs: number = 5000,
    ): Promise<WorkflowRun | null> {
        logger.info('Waiting for the workflow run to be created...');
        const startTime = Date.now();

        const checkIfWorkflowRunCreated = async (): Promise<WorkflowRun | null> => {
            const workflowRun = await this.getWorkflowRun(branch, customWorkflowRunId);
            if (workflowRun) {
                logger.info(`Workflow run found: ${workflowRun.name}`);
                return workflowRun;
            }

            // Check if the timeoutMs has been reached
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Timeout reached waiting for workflow run completion');
            }

            // Wait for the defined intervalMs then check again
            await sleep(intervalMs);
            return checkIfWorkflowRunCreated(); // Recurse until completion or timeoutMs
        };

        const result = await checkIfWorkflowRunCreated();
        return result;
    }

    async waitForWorkflowRunCompletion(
        branch: string,
        customWorkflowRunId: string,
        timeoutMs: number = 3000000, // FIXME move to the configuration
        intervalMs: number = 5000,
    ): Promise<WorkflowRun | null> {
        logger.info(`Waiting for the workflow run "${customWorkflowRunId}" in the branch "${branch}" to complete...`);
        const startTime = Date.now();

        const IN_PROGRESS_STATUSES: Statuses = {
            /**
             * The workflow is currently running.
             */
            in_progress: 'in_progress',
            /**
             * The workflow is waiting in the queue for resources to become available.
             */
            queued: 'queued',
            /**
             * The workflow has been requested but has not yet started.
             */
            requested: 'requested',
            /**
             * The workflow is on hold, waiting for an external condition or manual intervention.
             */
            waiting: 'waiting',
            /**
             * The workflow has begun initial processing but is not yet fully active.
             */
            pending: 'pending',
        };

        interface Statuses {
            in_progress: string;
            queued: string;
            requested: string;
            waiting: string;
            pending: string;
        }

        // FIXME same method is used in the waitForWorkflowRunCreation, extract it to avoid duplication
        const checkIfWorkflowRunCompleted = async (): Promise<WorkflowRun | null> => {
            const workflowRun = await this.getWorkflowRun(branch, customWorkflowRunId);
            if (workflowRun) {
                if (workflowRun.status) {
                    if (!IN_PROGRESS_STATUSES[workflowRun.status as keyof Statuses]) {
                        logger.info(`Workflow run completed with status: "${workflowRun.status}"`);
                        return workflowRun;
                    }

                    logger.debug(`Workflow run status: "${workflowRun.status}"`);
                    logger.debug('Workflow is not in the final state yet');
                }
            }

            // Check if the timeoutMs has been reached
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Timeout reached waiting for workflow run completion');
            }

            // Wait for the defined intervalMs then check again
            await sleep(intervalMs);
            return checkIfWorkflowRunCompleted();
        };

        const result = await checkIfWorkflowRunCompleted();

        return result;
    }

    /**
     * Downloads an artifact from a given URL and saves it to a specified path using axios.
     * @param artifact
     * @param artifactsPath
     */
    // eslint-disable-next-line class-methods-use-this
    async downloadArtifactToPath(artifact: Artifact, artifactsPath: string): Promise<void> { // FIXME rename
        try {
            const url = await this.getDownloadUrl(artifact.id);
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                // FIXME Ensure you handle large files correctly:
                maxContentLength: Infinity,
                // FIXME possibly this should be set in the configuration
                maxBodyLength: Infinity,
            });

            // FIXME use constants from the axios library
            if (response.status !== 200) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }

            const dirPath = path.resolve(__dirname, artifactsPath);
            // Write the downloaded data to a file
            const fullPath = path.resolve(
                dirPath,
                `${artifact.name}.zip`, // FIXME extract extension to the constant
            );
            await ensureDir(dirPath);
            await fsPromises.writeFile(fullPath, response.data);
            logger.info(`Artifact downloaded to: ${fullPath}`);
        } catch (error) {
            throw new Error(`Error downloading or writing file: ${error}`);
        }
    }

    async listWorkflowArtifacts(workflowRunId: number): Promise<Artifacts> {
        try {
            const response = await this.githubApiClient.listWorkflowArtifacts(workflowRunId);
            const { artifacts } = response.data;
            logger.debug('Received artifacts:', artifacts.map((artifact) => artifact.name));
            return artifacts;
        } catch (error) {
            throw new Error(`Error while listing artifacts: ${error}`);
        }
    }

    /**
     * Returns artifact download url.
     * @param artifactId
     */
    async getDownloadUrl(artifactId: number): Promise<string> {
        try {
            const response = await this.githubApiClient.downloadArtifact(artifactId);
            if (response.status === 200 && response.url) {
                return response.url;
            }
            throw new Error(`Failed to get download URL for artifact: "${artifactId}"`);
        } catch (e) {
            throw new Error(`Failed to get download URL for artifact: "${artifactId}"`);
        }
    }

    async downloadArtifacts(workflowRun: WorkflowRun, artifactsPath: string): Promise<void> {
        logger.info('Downloading artifacts...');
        const artifactsList = await this.listWorkflowArtifacts(workflowRun.id);
        logger.info(`Artifacts found: ${artifactsList.map((artifact) => artifact.name).join(', ')}`);

        await Promise.all(artifactsList.map((artifact) => {
            return this.downloadArtifactToPath(artifact, artifactsPath);
        }));
    }
}
