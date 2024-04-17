const { GitHubActionsRunner } = require('@adguard/github-actions-runner');

const githubActionsRunner = new GitHubActionsRunner({
    token: 'test',
    owner: 'test',
    repo: 'test',
});

console.log('created in cjs module', githubActionsRunner);
