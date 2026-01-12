import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

export function logOrderPlaced(marketId: number, side: string, price: number, size: number): void {
  logger.info('Order placed', { marketId, side, price, size });
}

export function logOrderCancelled(orderId: string, marketId: number): void {
  logger.info('Order cancelled', { orderId, marketId });
}

export function logRiskViolation(reason: string, details: Record<string, any>): void {
  logger.warn('Risk violation', { reason, ...details });
}

export function logError(message: string, error: Error): void {
  logger.error(message, { error: error.message, stack: error.stack });
}