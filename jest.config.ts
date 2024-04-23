module.exports = {
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
    testEnvironment: 'node',
    modulePathIgnorePatterns: ['smoke'],
    transformIgnorePatterns: ['node_modules/(?!(.*(nanoid))/)'], // since pnpm uses symlinks, we add `.*` to the path
};
