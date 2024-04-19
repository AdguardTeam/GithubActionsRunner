/**
 * A type guard to check if the error is an object containing a `status` property of type number.
 *
 * @param error An unknown error caught in a try-catch block.
 * @returns True if the error is an object with a `status` property that is a number.
 */
export function isErrorWithStatus(error: unknown): error is { status: number } {
    return typeof error === 'object'
        && error !== null
        && 'status' in error
        && typeof (error as { status: any }).status === 'number';
}
