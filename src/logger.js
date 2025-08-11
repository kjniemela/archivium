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
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
  ),
  transports: [
    rotateFileTransport,
    new winston.transports.Console(),
  ],
});

// Allows us to log errors sanely in winston
Error.prototype.toString = function() {
  let str = this.stack ?? this.message;

  if (this.cause) {
    str += `\nCaused by: ${this.cause.toString()}`;
  }

  return str;
};

module.exports = logger;
