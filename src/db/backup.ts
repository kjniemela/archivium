import { DB_CONFIG, DOMAIN } from '../config';
import logger from '../logger';
import { spawn } from 'child_process';

/**
 * Back up contents of database to Cloudflare R2 in case the database is lost.
 */
async function backup(): Promise<void> {
  logger.info('Backing up db...');

  try {
    const time = Date.now();
    const r2Target = `cloudflare-r2:archivium-backups/${DOMAIN}/${time}.sql.gz`;

    logger.info('Starting DB backup...');

    const dump = spawn('mysqldump', [
      '-h', DB_CONFIG.host,
      '-u', DB_CONFIG.user,
      DB_CONFIG.database,
    ], { env: { ...process.env, MYSQL_PWD: DB_CONFIG.password } });

    const gzip = spawn('gzip');

    const rclone = spawn('rclone', ['rcat', r2Target]);

    dump.stdout.pipe(gzip.stdin);
    gzip.stdout.pipe(rclone.stdin);

    return new Promise<void>((resolve, reject) => {
      dump.stderr.on('data', (data) => logger.error(`mysqldump: ${data}`));
      gzip.stderr.on('data', (data) => logger.error(`gzip: ${data}`));
      rclone.stderr.on('data', (data) => logger.error(`rclone: ${data}`));

      rclone.on('close', (code) => {
        if (code === 0) {
          logger.info(`Backup complete: ${DOMAIN}/${time}.sql.gz`);
          resolve();
        } else {
          reject(new Error(`Backup failed, rclone exit code: ${code}`));
        }
      });
    });
  } catch (err) {
    logger.error('Backup failed:', err);
  }
};

async function main() {
  await backup();
}

if (require.main === module) {
  main();
}

export default backup;
