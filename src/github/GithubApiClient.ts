import { Octokit } from 'octokit';
import { type RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

/**
 * Type definition for the artifact download response.
 */
interface ArtifactDownloadResponse {
    status: number;
    url: string;
}

/**
 * GitHubApi class.
 */
export class GithubApiClient {
    private readonly octokit: Octokit;

    private readonly owner: string;

    private readonly repo: string;

    constructor(token: string, owner: string, repo: string) {
        this.octokit = new Octokit({ auth: token });
        this.owner = owner;
        this.repo = repo;
    }

    /**
     * Gets the branch.
     * @param name The name of the branch
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
     * @param ref The reference for the commit (SHA, branch name, or tag name).
     */
    getCommit(ref: string): Promise<RestEndpointMethodTypes['repos']['getCommit']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
            owner: this.owner,
            repo: this.repo,
            ref,
        });
    }

    /**
     * Creates a dispatch event.
     * @param workflow The workflow id can be a filename or the workflow id.
     * @param ref
     * @param workflowRunCustomId - we need this id, so that later we can find workflow run dispatched by this event
     */
    async createDispatchEvent(workflow: string, ref: string, workflowRunCustomId: string):
    Promise<RestEndpointMethodTypes['actions']['createWorkflowDispatch']['response']> {
        return this.octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
            owner: this.owner,
            repo: this.repo,
            workflow_id: workflow,
            ref,
            inputs: {
                id: workflowRunCustomId,
            },
        });
    }

    /**
     * Lists all workflow runs in the repository with possible query configurations.
     * @param branch The name of the branch (optional).
     */
    async listWorkflowRuns(branch?: string):
    Promise<RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']> {
        const date = new Date();
        // FIXME: move to the constants, add comment that it is choosen arbitrarily,
        //  consider moving to the constant waitBeforeWorkflowRunStarted
        date.setMinutes(date.getMinutes() - 1000); // FIXME replace to 5
        const createdSince = date.toISOString();

        const params = {
            owner: this.owner,
            repo: this.repo,
            branch,
            created: `>=${createdSince}`,
            per_page: 100,
        };

        // FIXME run this several times until workflow run id is found, or timeout
        // If timeout, throw an error that the workflow run was not found and ask user to check if id was specified
        // correctly
        // FIXME also describe this in the README

        // FIXME handle errors
        const response = await this.octokit.request('GET /repos/{owner}/{repo}/actions/runs', params);
        return response;
    }

    async listWorkflowArtifacts(workflowRunId: number):
    Promise<RestEndpointMethodTypes['actions']['listWorkflowRunArtifacts']['response']> {
        return this.octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
            owner: this.owner,
            repo: this.repo,
            run_id: workflowRunId,
            per_page: 100, // FIXME to the constants
            // name: 'name' // FIXME consider using name, this will list artifacts with the specific name only
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
    }

    /**
     * Downloads an artifact and returns the direct download URL.
     * @param artifactId The unique identifier of the artifact.
     * @returns A Promise resolving to the direct download URL of the artifact.
     */
    async downloadArtifact(artifactId: number): Promise<ArtifactDownloadResponse> {
        return await this.octokit.request(
            'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}',
            {
                owner: this.owner,
                repo: this.repo,
                artifact_id: artifactId,
                archive_format: 'zip', // FIXME consider moving this to constants for consistency and reusability
            },
        ) as ArtifactDownloadResponse;
    }
}
