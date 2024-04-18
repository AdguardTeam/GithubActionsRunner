import { nanoid } from 'nanoid';
import axios, { HttpStatusCode } from 'axios';
import path from 'path';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { pipeline, Writable } from 'stream';
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

/**
 * Statuses for a workflow run, indicating state of the workflow in the progress.
 */
interface Statuses {
    /**
     * The workflow is currently running.
     */
    in_progress: string;

    /**
     * The workflow is waiting in the queue for resources to become available.
     */
    queued: string;

    /**
     * The workflow has been requested but has not yet started.
     */
    requested: string;

    /**
     * The workflow is on hold, waiting for an external condition or manual intervention.
     */
    waiting: string;

    /**
     * The workflow has begun initial processing but is not yet fully active.
     */
    pending: string;
}

/**
 * GithubApiManager class.
 * This class is responsible for managing the interactions with the GitHub API.
 */
export class GithubApiManager {
    private readonly githubApiClient: GithubApiClient;

    /**
     * Constructor.
     * Initializes a new instance of the GithubApiManager with the specified GitHub API client.
     *
     * @param apiClient The GitHub API client.
     */
    constructor(apiClient: GithubApiClient) {
        this.githubApiClient = apiClient;
    }

    /**
     * Checks if a commit exists.
     * @param commitRef The reference for the commit to check (SHA).
     * @returns A boolean indicating if the commit exists.
     * @throws An error if the commit check fails.
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
     * Waits for a commit to exist.
     *
     * @param commitRef The reference for the commit to wait for (SHA).
     * @param waitForCommitTimeoutMs The maximum time to wait in milliseconds.
     * @throws An error if the commit does not exist within the timeout.
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
     *
     * @param branch The name of the branch to check.
     * @returns A boolean indicating if the branch exists.
     * @throws An error if the branch check fails.
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
     * @param waitForBranchTimeoutMs The maximum time to wait in milliseconds.
     * @throws An error if the branch does not exist within the timeout.
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
     * Triggers a workflow on a branch.
     *
     * @param workflow The name of the workflow to trigger.
     * @param branch The name of the branch to trigger the workflow on.
     * @returns The custom ID of the workflow run.
     * @throws An error if the workflow trigger fails.
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

    /**
     * Gets a workflow run based on its custom ID.
     *
     * @param branch The branch for the workflow run.
     * @param customWorkflowRunId The ID of the workflow run.
     * @returns The workflow run if found, otherwise null.
     * @throws An error if the workflow run retrieval fails.
     */
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
     * Waits for a specific workflow run to be created with a workflowRunCreationTimeoutMs.
     *
     * @param branch The branch for the workflow run.
     * @param customWorkflowRunId The ID of the workflow run.
     * @param workflowRunCreationTimeoutMs The maximum time to wait in milliseconds.
     * @returns The workflow run if found, otherwise null.
     * @throws An error if the workflow run creation fails.
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
                logger.info(`Workflow run found: "${workflowRun.name}"`);
                return workflowRun;
            }

            // Check if the workflowRunCreationTimeoutMs has been reached
            if (Date.now() - startTime > workflowRunCreationTimeoutMs) {
                throw new Error('Timeout reached waiting for workflow run creation');
            }

            // Wait for the defined intervalMs then check again
            await sleep(POLLING_INTERVAL_MS);
            return checkIfWorkflowRunCreated(); // Recurse until completion or workflowRunCreationTimeoutMs
        };

        const result = await checkIfWorkflowRunCreated();
        return result;
    }

    /**
     * Logs how much time has passed since the workflow run started.
     * @param workflowRun The workflow run info to log the time for.
     */
    private static logHowMuchTimePassed(workflowRun: WorkflowRun): void {
        if (!workflowRun.run_started_at) {
            // impossible here, since we log after workflow run has started
            logger.error(`Workflow run has not started yet, status: ${workflowRun.status}}`);
            return;
        }

        const startedAt = workflowRun.run_started_at;
        const currentTime = new Date();
        const workflowStartTime = new Date(startedAt);
        const durationSeconds = Math.floor((currentTime.getTime() - workflowStartTime.getTime()) / 1000);

        // Log the time the build has been running and its current status
        logger.info(`Build is running for: ${durationSeconds} seconds, current status is: "${workflowRun.status}"`);
    }

    /**
     * Waits for a specific workflow run to complete with a workflowRunCompletionTimeoutMs.
     *
     * @param branch The branch for the workflow run.
     * @param customWorkflowRunId The ID of the workflow run.
     * @param workflowRunCompletionTimeoutMs The maximum time to wait workflow run completion in milliseconds.
     * @returns The workflow run if found, otherwise null.
     * @throws An error if the workflow run completion fails.
     */
    async waitForWorkflowRunCompletion(
        branch: string,
        customWorkflowRunId: string,
        workflowRunCompletionTimeoutMs: number,
    ): Promise<WorkflowRun | null> {
        logger.info(`Waiting for the workflow run "${customWorkflowRunId}" in the branch "${branch}" to complete...`);
        const startTime = Date.now();

        /**
         * Statuses for a workflow run, indicating state of the workflow in the progress.
         */
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

        const checkIfWorkflowRunCompleted = async (): Promise<WorkflowRun | null> => {
            const workflowRun = await this.getWorkflowRun(branch, customWorkflowRunId);
            if (workflowRun) {
                GithubApiManager.logHowMuchTimePassed(workflowRun);

                if (workflowRun.status) {
                    if (!IN_PROGRESS_STATUSES[workflowRun.status as keyof Statuses]) {
                        logger.info(`Workflow run completed with status: "${workflowRun.status}"`);
                        return workflowRun;
                    }

                    logger.debug(`Workflow run status: "${workflowRun.status}"`);
                    logger.debug('Workflow is not in the final state yet');
                }
            }

            // Check if the workflowRunCompletionTimeoutMs has been reached
            if (Date.now() - startTime > workflowRunCompletionTimeoutMs) {
                throw new Error('Timeout reached waiting for workflow run completion');
            }

            // Wait for the defined interval and then check again
            await sleep(POLLING_INTERVAL_MS);
            return checkIfWorkflowRunCompleted();
        };

        const result = await checkIfWorkflowRunCompleted();

        return result;
    }

    /**
     * Downloads an artifact from a given URL, saves it to a specified path, and unzips it using axios,
     * while ensuring the download size does not exceed the specified ARTIFACTS_MAX_DOWNLOAD_SIZE_BYTES.
     *
     * @param artifact The artifact to download.
     * @param artifactsPath The path to save the downloaded artifact.
     * @returns A promise that resolves when the download and extraction are complete.
     * @throws An error if the download or extraction fails.
     */
    async downloadArtifactToPath(artifact: Artifact, artifactsPath: string): Promise<void> {
        try {
            const url = await this.getArtifactDownloadUrl(artifact.id);

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

    /**
     * Lists all artifacts for a given workflow run.
     *
     * @param workflowRunId The ID of the workflow run.
     * @returns A promise that resolves to the list of artifacts.
     * @throws An error if the artifact listing fails.
     */
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
     *
     * @param artifactId The ID of the artifact.
     * @returns A promise that resolves to the download URL of the artifact.
     * @throws An error if the download URL retrieval fails.
     */
    async getArtifactDownloadUrl(artifactId: number): Promise<string> {
        try {
            const response = await this.githubApiClient.getArtifactDownloadUrl(artifactId);
            if (response.status === HttpStatusCode.Ok && response.url) {
                return response.url;
            }
            throw new Error(`Failed to get download URL for artifact: "${artifactId}"`);
        } catch (e) {
            throw new Error(`Failed to get download URL for artifact: "${artifactId}"`);
        }
    }

    /**
     * Downloads all artifacts from a given workflow run and saves them to a specified path.
     *
     * @param workflowRun The workflow run to download artifacts from.
     * @param artifactsPath The path to save the downloaded artifacts.
     * @returns A promise that resolves when all artifacts are downloaded.
     * @throws An error if the download fails.
     */
    async downloadArtifacts(workflowRun: WorkflowRun, artifactsPath: string): Promise<void> {
        logger.info('Downloading artifacts...');
        const artifactsList = await this.listWorkflowArtifacts(workflowRun.id);
        logger.info(`Artifacts found: ${artifactsList.map((artifact) => artifact.name).join(', ')}`);

        await Promise.all(artifactsList.map((artifact) => {
            return this.downloadArtifactToPath(artifact, artifactsPath);
        }));
    }

    /**
     * Fetches the logs for a given workflow run.
     * The logs are fetched from the GitHub API and returned as a string.
     * @param workflowRunId The ID of the workflow run.
     * @returns A promise that resolves to the logs for the workflow run.
     */
    async fetchWorkflowRunLogs(workflowRunId: number): Promise<string> {
        /**
         * In the archive with logs there are several files, separated by jobs,
         * but we are interested in the whole log, which is in the file with the name "0_<job_name>.txt".
         */
        const WHOLE_LOG_PATH_BEGINNING = '0_';
        const LOG_EXTENSION = '.txt';

        const logContent: string[] = [];

        try {
            // Fetch the URL for the workflow logs.
            const response = await this.githubApiClient.getWorkflowRunLogsUrl(workflowRunId);
            if (!response || !response.url) {
                throw new Error(`Unable to retrieve log URL or URL is undefined for workflowRunId: ${workflowRunId}`);
            }

            const { data: logsStream } = await axios.get(
                response.url,
                { responseType: 'stream' },
            );

            // Using a stream pipeline to process the stream and print the log data.
            await pipelinePromise(
                logsStream,
                unzipper.Parse(),
                new Writable({
                    objectMode: true,
                    async write(entry, encoding, callback): Promise<void> {
                        if (entry.path.startsWith(WHOLE_LOG_PATH_BEGINNING) && entry.path.endsWith(LOG_EXTENSION)) {
                            for await (const chunk of entry) {
                                logContent.push(chunk);
                            }
                            callback();
                        } else {
                            // Skip non-required files.
                            entry.autodrain().on('finish', callback);
                        }
                    },
                }),
            );
            return `\n
            ----GITHUB WORKFLOW RUN LOGS START----\n
${logContent.join('')}
            ----GITHUB WORKFLOW RUN LOGS END----\n`;
        } catch (e) {
            throw new Error(`Failed to fetch logs: ${e}`);
        }
    }
}
