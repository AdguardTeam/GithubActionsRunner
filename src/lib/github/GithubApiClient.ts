import { Octokit } from 'octokit';
import { type RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { WORKFLOW_CREATED_WITHIN_MS } from '../constants';

/**
 * Number of items to fetch per page.
 */
const PER_PAGE = 100;

/**
 * ResponseWithDownloadUrl interface.
 */
interface ResponseWithDownloadUrl {
    status: number;
    url: string;
}

/**
 * The archive format for the artifact.
 * Currently, only zip is supported.
 */
const ARCHIVE_FORMAT = 'zip';

/**
 * GithubApiClient class.
 * This class is a wrapper around the Octokit instance.
 */
export class GithubApiClient {
    /**
     * The Octokit instance.
     * @private
     */
    private readonly octokit: Octokit;

    /**
     * The owner of the repository.
     * @private
     */
    private readonly owner: string;

    /**
     * The repository name.
     * @private
     */
    private readonly repo: string;

    /**
     * Constructor.
     * Initializes a new instance of the GithubApiClient with specified authentication and repository details.
     *
     * @param token The GitHub authentication token.
     * @param owner The owner of the repository.
     * @param repo The repository name.
     */
    constructor(token: string, owner: string, repo: string) {
        this.octokit = new Octokit({ auth: token });
        this.owner = owner;
        this.repo = repo;
    }

    /**
     * Gets the branch.
     *
     * @param name The name of the branch.
     * @returns A promise that resolves to the response.
     */
    getBranch(name: string): Promise<RestEndpointMethodTypes['repos']['getBranch']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', {
            owner: this.owner,
            repo: this.repo,
            branch: name,
        });
    }

    /**
     * Gets a commit based on its reference.
     *
     * @param ref The reference for the commit (SHA, branch name, or tag name).
     * @returns A promise that resolves to the response.
     */
    getCommit(ref: string): Promise<RestEndpointMethodTypes['repos']['getCommit']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
            owner: this.owner,
            repo: this.repo,
            ref,
        });
    }

    /**
     * Creates a dispatch event for a workflow.
     *
     * @param workflow The identifier of the workflow, which can be either a filename or the workflow ID.
     * @param branch The branch name.
     * @param workflowRunCustomId An identifier to track the workflow run initiated by this dispatch event.
     * @returns A promise that resolves to the dispatch event creation response.
     */
    async createDispatchEvent(workflow: string, branch: string, workflowRunCustomId: string):
    Promise<RestEndpointMethodTypes['actions']['createWorkflowDispatch']['response']> {
        return this.octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
            owner: this.owner,
            repo: this.repo,
            workflow_id: workflow,
            ref: branch,
            inputs: {
                id: workflowRunCustomId,
            },
        });
    }

    /**
     * Lists all workflow runs for a specified branch in the repository.
     * If no branch is provided, runs for all repository are listed.
     *
     * @param branch The name of the branch, optional.
     * @returns A promise that resolves to the list of workflow runs.
     */
    async listWorkflowRuns(branch?: string):
    Promise<RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']> {
        const date = new Date();
        date.setTime(date.getTime() - WORKFLOW_CREATED_WITHIN_MS);

        const createdSince = date.toISOString();

        const params = {
            owner: this.owner,
            repo: this.repo,
            branch,
            created: `>=${createdSince}`,
            per_page: PER_PAGE,
        };

        return this.octokit.request('GET /repos/{owner}/{repo}/actions/runs', params);
    }

    /**
     * Gets a workflow run based on its id.
     *
     * @param workflowRunId The id of the workflow run.
     * @returns A promise that resolves to the workflow run artefacts list.
     */
    async listWorkflowArtifacts(workflowRunId: number):
    Promise<RestEndpointMethodTypes['actions']['listWorkflowRunArtifacts']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
            owner: this.owner,
            repo: this.repo,
            run_id: workflowRunId,
            per_page: PER_PAGE,
            // TODO consider using name, this will list artifacts with the specific name only
            // name: 'name'
        });
    }

    /**
     * Gets the download URL for a specific artifact.
     * The download URL is valid for 1 minute.
     *
     * @param artifactId The id of the artifact.
     * @returns A promise that resolves to the download URL.
     */
    async getArtifactDownloadUrl(artifactId: number): Promise<ResponseWithDownloadUrl> {
        return await this.octokit.request(
            'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}',
            {
                owner: this.owner,
                repo: this.repo,
                artifact_id: artifactId,
                archive_format: ARCHIVE_FORMAT,
            },
        ) as ResponseWithDownloadUrl;
    }

    /**
     * Gets the logs download url for a specific workflow run.
     * The download URL is valid for 1 minute.
     * @param workflowRunId The id of the workflow run.
     * @returns A promise that resolves to the object with download URL and status.
     */
    async getWorkflowRunLogsUrl(workflowRunId: number): Promise<ResponseWithDownloadUrl> {
        return await this.octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs', {
            owner: this.owner,
            repo: this.repo,
            run_id: workflowRunId,
        }) as ResponseWithDownloadUrl;
    }

    /**
     * Gets the public key for the repository.
     * The public key is used to encrypt secrets.
     * @returns A promise that resolves to the public key.
     */
    async getPublicKey(): Promise<RestEndpointMethodTypes['actions']['getRepoPublicKey']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
            owner: this.owner,
            repo: this.repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
    }

    /**
     * Sets a secret for the repository.
     * @param key The secret key.
     * @param encryptedValue The encrypted value.
     * @param publicKeyId The public key id.
     * @returns A promise that resolves to the response.
     */
    async setSecret(
        key: string,
        encryptedValue: string,
        publicKeyId: string,
    ): Promise<RestEndpointMethodTypes['actions']['createOrUpdateRepoSecret']['response']> {
        return this.octokit.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
            owner: this.owner,
            repo: this.repo,
            secret_name: key,
            encrypted_value: encryptedValue,
            key_id: publicKeyId,
        });
    }

    /**
     * Lists all secrets for the repository.
     * @returns A promise that resolves to the list of secrets.
     */
    async listSecrets(): Promise<RestEndpointMethodTypes['actions']['listRepoSecrets']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/actions/secrets', {
            owner: this.owner,
            repo: this.repo,
            per_page: PER_PAGE,
        });
    }

    /**
     * Deletes a secret from the repository.
     * @param key The secret name.
     * @returns A promise that resolves to the response.
     */
    async deleteSecret(key: string): Promise<RestEndpointMethodTypes['actions']['deleteRepoSecret']['response']> {
        return this.octokit.request('DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
            owner: this.owner,
            repo: this.repo,
            secret_name: key,
        });
    }
}
