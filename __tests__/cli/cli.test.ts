import { program } from '../../src/cli/cli';

const mockRunAction = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/lib/GitHubActionsRunner', () => ({
    GitHubActionsRunner: jest.fn().mockImplementation(() => ({
        runAction: mockRunAction,
    })),
}));

describe('CLI Integration Tests', () => {
    it('should collect secrets correctly', async () => {
        // Perform command parsing to trigger action
        await program.parseAsync([
            'node',
            'github-actions-runner',
            'run-action',
            '-r', 'owner/repo',
            '-w', 'workflow.yml',
            '-b', 'main',
            '-c', '1234',
            '-s', 'KEY=VALUE',
            '-s', 'KEY2=VALUE2',
        ]);

        // Assert the mocked function was called with the correct arguments
        expect(mockRunAction).toHaveBeenCalledWith(expect.objectContaining({
            secrets: expect.arrayContaining(['KEY=VALUE', 'KEY2=VALUE2']),
        }));
    });
});
