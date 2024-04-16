// FIXME this linter error without turning off the rule:
// eslint-disable-next-line import/no-extraneous-dependencies
import { createLogger, format, transports } from 'winston';

const {
    combine,
    timestamp,
    simple,
    colorize,
} = format;

// eslint-disable-next-line @typescript-eslint/no-shadow
const myFormat = format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

const transport = new transports.Console();

// FIXME description
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

// FIXME description
const setLoggerLevel = (logLevel: string): void => {
    transport.level = logLevel;
};

export { logger, setLoggerLevel };
