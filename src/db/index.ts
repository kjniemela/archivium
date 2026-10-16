import mysql from 'mysql2/promise';
import { DB_CONFIG } from '../config';
import logger from '../logger';

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
});

logger.info(`Created MySQL connection pool for ${DB_CONFIG.database}`);
export default pool;
