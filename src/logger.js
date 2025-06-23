const winston = require('winston');
require('winston-daily-rotate-file');
const { DEV_MODE } = require('./config');

const rotateFileTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxSize: '20m',
  maxFiles: '28d',
  createSymlink: true,
});

const logger = winston.createLogger({
  level: DEV_MODE ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
  ),
  transports: [
    rotateFileTransport,
    new winston.transports.Console(),
  ],
});

module.exports = logger;
