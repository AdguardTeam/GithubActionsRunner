import { nanoid } from 'nanoid';
import axios, { HttpStatusCode } from 'axios';
import path from 'path';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as unzipper from 'unzipper';
import { ensureDir } from 'fs-extra';

import { sleep } from '../utils/time';
import { isErrorWithStatus } from '../utils/errors';
import { type GithubApiClient } from './GithubApiClient';
import { logger } from '../utils/logger';
import { ARTIFACTS_MAX_DOWNLOAD_SIZE_BYTES, POLLING_INTERVAL_MS } from '../constants';

const pipelinePromise = promisify(pipeline);

type WorkflowRuns = RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']['data']['workflow_runs'];
export type WorkflowRun = WorkflowRuns[number];
type Artifacts = RestEndpointMethodTypes['actions']['listWorkflowRunArtifacts']['response']['data']['artifacts'];
export type Artifact = Artifacts[number];

export class GithubApiManager {
    private readonly githubApiClient: GithubApiClient;

    constructor(apiClient: GithubApiClient) {
        this.githubApiClient = apiClient;
    }

    /**
     /**
     * Checks if a commit exists based on its reference.
     * @param commitRef The reference for the commit.
     */
    async hasCommit(commitRef: string): Promise<boolean> {
        try {
            const response = await this.githubApiClient.getCommit(commitRef);
            return response.status === HttpStatusCode.Ok;
        } catch (error) {
            if (isErrorWithStatus(error) && error.status === HttpStatusCode.NotFound) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Waits for a commit to exist in the repository.
     * @param commitRef The reference for the commit to wait for (SHA, branch name, or tag name).
     * @param waitForCommitTimeoutMs The maximum time to wait for the commit to appear in repository in milliseconds.
     */
    async waitForCommit(
        commitRef: string,
        waitForCommitTimeoutMs: number,
    ): Promise<void> {
        logger.info(`Waiting for commit "${commitRef}" ...`);
        const startTime = Date.now();

        const tryFetchCommit = async (): Promise<void> => {
            const exists = await this.hasCommit(commitRef);
            if (exists) {
                logger.info(`Commit "${commitRef}" found.`);
                return;
            }

            if (Date.now() - startTime > waitForCommitTimeoutMs) {
                throw new Error(`Timeout waiting for commit "${commitRef}".`);
            }

            logger.debug(
                `Commit "${commitRef}" not found. Retrying in ${POLLING_INTERVAL_MS / 1000} seconds...`,
            );

            await sleep(POLLING_INTERVAL_MS);
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
            return response.status === HttpStatusCode.Ok;
        } catch (error) {
            if (isErrorWithStatus(error) && error.status === HttpStatusCode.NotFound) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Waits for a branch to exist.
     * @param branchName The name of the branch to wait for.
     * @param waitForBranchTimeoutMs
     */
    async waitForBranch(
        branchName: string,
        waitForBranchTimeoutMs: number,
    ): Promise<void> {
        logger.info(`Waiting for branch "${branchName}"...`);
        const startTime = Date.now();

        const tryFetchBranch = async (): Promise<void> => {
            const exists = await this.hasBranch(branchName);
            if (exists) {
                logger.info(`Branch "${branchName}" found.`);
                return;
            }

            if (Date.now() - startTime > waitForBranchTimeoutMs) {
                throw new Error(`Timeout waiting for branch "${branchName}".`);
            }

            logger.debug(
                `Branch "${branchName}" not found. 
                Retrying in "${POLLING_INTERVAL_MS / 1000}" seconds...`,
            );
            await sleep(POLLING_INTERVAL_MS);
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
        if (response.status !== HttpStatusCode.NoContent) {
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
     * Waits for a specific workflow run to complete with a workflowRunCreationTimeoutMs.
     * @param branch The branch for the workflow run.
     * @param customWorkflowRunId The ID of the workflow run.
     * @param workflowRunCreationTimeoutMs The maximum time to wait in milliseconds.
     */
    async waitForWorkflowRunCreation(
        branch: string,
        customWorkflowRunId: string,
        workflowRunCreationTimeoutMs: number,
    ): Promise<WorkflowRun | null> {
        logger.info('Waiting for the workflow run to be created...');
        const startTime = Date.now();

        const checkIfWorkflowRunCreated = async (): Promise<WorkflowRun | null> => {
            const workflowRun = await this.getWorkflowRun(branch, customWorkflowRunId);
            if (workflowRun) {
                logger.info(`Workflow run found: ${workflowRun.name}`);
                return workflowRun;
            }

            // Check if the workflowRunCreationTimeoutMs has been reached
            if (Date.now() - startTime > workflowRunCreationTimeoutMs) {
                throw new Error('Timeout reached waiting for workflow run completion');
            }

            // Wait for the defined intervalMs then check again
            await sleep(POLLING_INTERVAL_MS);
            return checkIfWorkflowRunCreated(); // Recurse until completion or workflowRunCreationTimeoutMs
        };

        const result = await checkIfWorkflowRunCreated();
        return result;
    }

    /**
     * Waits for a specific workflow run to complete with a workflowRunCompletionTimeoutMs.
     * @param branch
     * @param customWorkflowRunId
     * @param workflowRunCompletionTimeoutMs
     */
    async waitForWorkflowRunCompletion(
        branch: string,
        customWorkflowRunId: string,
        workflowRunCompletionTimeoutMs: number,
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
            if (Date.now() - startTime > workflowRunCompletionTimeoutMs) {
                throw new Error('Timeout reached waiting for workflow run completion');
            }

            // Wait for the defined intervalMs then check again
            await sleep(POLLING_INTERVAL_MS);
            return checkIfWorkflowRunCompleted();
        };

        const result = await checkIfWorkflowRunCompleted();

        return result;
    }

    /**
     * Downloads an artifact from a given URL, saves it to a specified path, and unzips it using axios,
     * while ensuring the download size does not exceed the specified ARTIFACTS_MAX_DOWNLOAD_SIZE_BYTES.
     * @param artifact
     * @param artifactsPath
     */
    async downloadArtifactToPath(artifact: Artifact, artifactsPath: string): Promise<void> {
        try {
            const url = await this.getDownloadUrl(artifact.id);

            const response = await axios({
                method: 'GET',
                url,
                responseType: 'stream',
                maxContentLength: ARTIFACTS_MAX_DOWNLOAD_SIZE_BYTES,
            });

            if (response.status !== HttpStatusCode.Ok) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }

            // Prepare the path for the artifacts
            const dirPath = path.resolve(process.cwd(), artifactsPath);
            await ensureDir(dirPath);

            // Pipe streaming data to zip extraction
            await pipelinePromise(
                response.data,
                unzipper.Extract({ path: dirPath }),
            );

            logger.info(`Artifact saved to: ${dirPath}/${artifact.name}`);
        } catch (error) {
            throw new Error(`Error downloading or extracting file: ${error}`);
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
            if (response.status === HttpStatusCode.Ok && response.url) {
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
