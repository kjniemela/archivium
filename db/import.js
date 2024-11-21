const mysql = require('mysql2');
const dbConfig = require('./config');
const Promise = require('bluebird');
const fsPromises = require('fs').promises;
const readline = require('readline');
const path = require('path');
const dbExport = require('./export');

function formatTypes(type, data) {
  if (type === 'datetime' || type === 'date' || type === 'timestamp') {
    return data ? new Date(data) : null;
  } else if (type === 'longblob') {
    return Buffer.from(data.data);
  } else {
    return data;
  }
}

// https://stackoverflow.com/a/50890409
function askQuestion(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
      rl.close();
      resolve(ans);
    }));
}

async function dropDb(db) {
  await db.ready;
  const ans = await askQuestion(`This will DROP the ${dbConfig.database} database! Are you SURE? [y/N] `);
  if (ans.toUpperCase() === 'Y') {
    const ans = await askQuestion(`Skip exporting ${dbConfig.database} database first? [y/N] `);
    if (ans.toUpperCase() === 'N') {
      await dbExport(db);
    }
    await db.queryAsync(`DROP DATABASE IF EXISTS ${dbConfig.database};`);
    await db.queryAsync(`CREATE DATABASE ${dbConfig.database};`);
    console.log('Dropped database.')
  } else {
    console.log('Aborting.');
    process.exit();
  }
}

async function loadSchema(db) {
  // drop old database and reload the schema
  await dropDb(db);
  await db.queryAsync(`USE ${dbConfig.database};`);
  const schema = await fsPromises.readFile(path.join(__dirname, 'schema.sql'), { encoding: 'utf8' });
  await db.queryAsync(schema);
  console.log('Loaded schema.')
}

/**
 * **Replaces** contents of database with JSON data loaded from file.
 * 
 * This resets the **entire** database. Use with caution.
 */
async function dbImport(db, reset=true) {
  if (reset) await loadSchema(db);

  // disable constraint checking
  await db.queryAsync('SET FOREIGN_KEY_CHECKS = 0;');

  const tables = (await db.queryAsync('SHOW TABLES;'))[0].map(item => item[`Tables_in_${dbConfig.database}`]);
  
  for (const table of tables) {
    if (table === 'session') continue;
    try {
      const data = JSON.parse(await fsPromises.readFile(path.join(__dirname, `export/${table}.json`), { encoding: 'utf8' }));
      for (const id in data.items) {
        const keys = Object.keys(data.items[id]);
        for (const key of keys) {
          data.items[id][key] = formatTypes(data.types[key], data.items[id][key]);
        }
        await db.queryAsync(
          `INSERT INTO ${table} (${keys.join(',')}) VALUES (${'?'.repeat(keys.length).split('').join(',')});`,
          Object.values(data.items[id])
        );
      }
      console.log(`Imported table ${table}`);
    } catch(err) {
      if (err.code === 'ENOENT') console.error(`Missing file ${table}.json, skipping.`)
      else console.error(err);
    }
  }
  // reenable constraint checking
  await db.queryAsync('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('Done.');
};
async function main() {
  const connection = mysql.createConnection({ ...dbConfig, multipleStatements: true });
  const db = Promise.promisifyAll(connection, { multiArgs: true });
  await dbImport(db);
  db.end();
}
if (require.main === module) {
  main();
}
module.exports = {
  askQuestion,
  dropDb,
  loadSchema,
  dbImport,
};
