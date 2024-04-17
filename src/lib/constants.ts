export const DEFAULT_WAIT_FOR_COMMIT_TIMEOUT_MS = 1000 * 60 * 5;
export const DEFAULT_WAIT_FOR_BRANCH_TIMEOUT_MS = 1000 * 60 * 5;
export const POLLING_INTERVAL_MS = 1000 * 5;
export const DEFAULT_WORKFLOW_RUN_CREATION_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_WORKFLOW_RUN_COMPLETION_TIMEOUT_MS = 5 * 60 * 1000;
export const ARTIFACTS_MAX_DOWNLOAD_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB in bytes

/**
 * Select only the workflows created within the last 5 minutes.
 * This is to avoid listing all the workflows in the repository.
 * Value was chosen arbitrarily.
 */
export const WORKFLOW_CREATED_WITHIN_MS = 1000 * 60 * 5;
