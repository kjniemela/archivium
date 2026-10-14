import { promises as fsPromises } from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';
import { DB_CONFIG, DEV_MODE } from '../config';
import { askQuestion } from './cliUtils';

async function dropDb(db: mysql.Connection) {
  if (!DEV_MODE) {
    console.log('Dropping database on production system is not allowed (DEV_MODE=false).');
    process.exit();
  }
  const ans = await askQuestion(`This will DROP the ${DB_CONFIG.database} database! Are you SURE? [y/N] `);
  if (ans.toUpperCase() === 'Y') {
    await db.query(`DROP DATABASE IF EXISTS ${DB_CONFIG.database};`);
    await db.query(`CREATE DATABASE ${DB_CONFIG.database};`);
    console.log('Dropped database.')
  } else {
    console.log('Aborting.');
    process.exit();
  }
}

export async function loadSchema(db: mysql.Connection, useRef=true) {
  // drop old database and reload the schema
  await dropDb(db);
  await db.query(`USE ${DB_CONFIG.database};`);
  const schema = await fsPromises.readFile(path.join(__dirname, `schema${useRef ? '_ref' : ''}.sql`), { encoding: 'utf8' });
  await db.query(schema);
  console.log('Loaded schema.')
}

async function main() {
  const db = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
  await loadSchema(db);
  db.end();
}
if (require.main === module) {
  main();
}
