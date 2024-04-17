import { createLogger, format, transports } from 'winston';

const {
    combine,
    timestamp,
    simple,
    colorize,
} = format;

/**
 * Custom formatting function for log messages.
 * @param logInfo - The log information containing level, message, and timestamp.
 * @returns Formatted log message.
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
const myFormat = format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

/**
 * Default transport for logging to the console.
 * It is initiated separately to allow for changing the logging level.
 */
const transport = new transports.Console();

/**
 * Create a logger instance configured for console output with custom settings.
 * Includes a timestamp, simple log format, colorized output, and a custom format.
 * Default metadata tags logs with the 'github-actions-runner' service.
 */
const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        simple(),
        colorize(),
        myFormat,
    ),
    defaultMeta: { service: 'github-actions-runner' },
    transports: [
        transport,
    ],
});

/**
 * Updates the logging level for the default transport.
 * @param logLevel - The new logging level to be set.
 */
const setLoggerLevel = (logLevel: string): void => {
    transport.level = logLevel;
};

export { logger, setLoggerLevel };
