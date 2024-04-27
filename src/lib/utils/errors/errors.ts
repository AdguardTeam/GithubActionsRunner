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

type ErrorWithMessage = {
    message: string
};

/**
 * Checks if error has message.
 *
 * @param error Error object.
 * @returns If param is error.
 */
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Converts error to the error with message.
 *
 * @param maybeError Possible error.
 * @returns Error with message.
 */
function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (isErrorWithMessage(maybeError)) {
        return maybeError;
    }

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError));
    }
}

/**
 * Converts error object to error with message. This method might be helpful to handle thrown errors.
 *
 * @param error Error object.
 *
 * @returns Message of the error.
 */
export function getErrorMessage(error: unknown): string {
    return toErrorWithMessage(error).message;
}
