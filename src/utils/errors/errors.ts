/**
 * A type guard to check if the error is an object containing a `status` property.
 * @param error An unknown error caught in a try-catch block.
 */
export function isErrorWithStatus(error: unknown): error is { status: number } {
    return typeof error === 'object' && error !== null && 'status' in error;
}
