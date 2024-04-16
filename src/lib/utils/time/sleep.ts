/**
 * Await for a given amount of time
 * @param ms - Time to wait in milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
