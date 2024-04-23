import { GithubApiManager } from '../../../src/lib/github/GithubApiManager';
import { GithubApiClient } from '../../../src/lib/github/GithubApiClient';

// Silence logger output
jest.mock('../../../src/lib/utils/logger');

describe('GithubApiManager', () => {
    describe('downloadArtifacts', () => {
        it('throws error if no artifacts found', async () => {
            const githubApiClient = new GithubApiClient('test', 'test', 'test');
            githubApiClient.listWorkflowArtifacts = jest.fn().mockResolvedValue({ data: { artifacts: [] } });

            const githubApiManager = new GithubApiManager(githubApiClient);
            await expect(githubApiManager.downloadArtifacts({ id: 1 }, 'test')).rejects.toThrow('No artifacts found');
        });
    });
});
