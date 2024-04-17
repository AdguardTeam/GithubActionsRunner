#!/bin/bash

set -e  # Exit on error

# pack @adguard/github-actions-runner
curr_path="__tests__/smoke/cjs"
github_actions_runner="github-actions-runner.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Cleaning up..."
    rm -f $github_actions_runner && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack && mv adguard-github-actions-runner-*.tgz "$curr_path/$github_actions_runner")

# unzip to @adguard/github-actions-runner to node_modules
github_actions_runner_node_modules=$nm_path"/@adguard/github-actions-runner"
mkdir -p $github_actions_runner_node_modules
tar -xzf $github_actions_runner --strip-components=1 -C $github_actions_runner_node_modules

pnpm start
echo "Test successfully built."
