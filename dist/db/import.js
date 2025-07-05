const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');
const Promise = require('bluebird');
const fsPromises = require('fs').promises;
const readline = require('readline');
const path = require('path');
const dbExport = require('./export');
const { DEV_MODE } = require('../config');
function formatTypes(type, data) {
    if (type === 'datetime' || type === 'date' || type === 'timestamp') {
        return data ? new Date(data) : null;
    }
    else if (type === 'longblob') {
        return Buffer.from(data.data);
    }
    else {
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
    if (!DEV_MODE) {
        console.log('Dropping database on production system is not allowed (DEV_MODE=false).');
        process.exit();
    }
    const ans = await askQuestion(`This will DROP the ${DB_CONFIG.database} database! Are you SURE? [y/N] `);
    if (ans.toUpperCase() === 'Y') {
        const ans = await askQuestion(`Skip exporting ${DB_CONFIG.database} database first? [y/N] `);
        if (ans.toUpperCase() === 'N') {
            await dbExport(db);
        }
        await db.query(`DROP DATABASE IF EXISTS ${DB_CONFIG.database};`);
        await db.query(`CREATE DATABASE ${DB_CONFIG.database};`);
        console.log('Dropped database.');
    }
    else {
        console.log('Aborting.');
        process.exit();
    }
}
async function loadSchema(db, useRef = true) {
    // drop old database and reload the schema
    await dropDb(db);
    await db.query(`USE ${DB_CONFIG.database};`);
    const schema = await fsPromises.readFile(path.join(__dirname, `schema${useRef ? '_ref' : ''}.sql`), { encoding: 'utf8' });
    await db.query(schema);
    console.log('Loaded schema.');
}
/**
 * **Replaces** contents of database with JSON data loaded from file.
 *
 * This resets the **entire** database. Use with caution.
 */
async function dbImport(db, reset = true) {
    if (reset)
        await loadSchema(db);
    // disable constraint checking
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    const tables = (await db.query('SHOW TABLES;'))[0].map(item => item[`Tables_in_${DB_CONFIG.database}`]);
    for (const table of tables) {
        if (table === 'session')
            continue;
        try {
            const data = JSON.parse(await fsPromises.readFile(path.join(__dirname, `export/${table}.json`), { encoding: 'utf8' }));
            for (const id in data.items) {
                const keys = Object.keys(data.items[id]);
                for (const key of keys) {
                    data.items[id][key] = formatTypes(data.types[key], data.items[id][key]);
                }
                await db.execute(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${'?'.repeat(keys.length).split('').join(',')});`, Object.values(data.items[id]));
            }
            console.log(`Imported table ${table}`);
        }
        catch (err) {
            if (err.code === 'ENOENT')
                console.error(`Missing file ${table}.json, skipping.`);
            else
                console.error(err);
        }
    }
    // reenable constraint checking
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Done.');
}
;
async function main() {
    const db = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
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
