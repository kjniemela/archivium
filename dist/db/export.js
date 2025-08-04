const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');
const fsPromises = require('fs').promises;
const path = require('path');
/**
 * Export contents of database to JSON for ETL purposes.
 */
async function dbExport(db) {
    const tables = (await db.query('SHOW TABLES;'))[0].map(item => item[`Tables_in_${DB_CONFIG.database}`]);
    for (const table of tables) {
        console.log(table);
        if (table === 'session')
            continue;
        const types = {};
        const typeArray = (await db.query(`DESCRIBE ${table};`))[0].map(item => types[item.Field] = item.Type);
        // console.log(types)
        const itemArray = await db.query(`SELECT * FROM ${table};`);
        const items = {};
        itemArray[0].forEach((item, i) => {
            items[i] = item;
        });
        await fsPromises.writeFile(path.join(__dirname, `export/${table}.json`), JSON.stringify({
            types,
            items,
        }));
    }
}
;
async function main() {
    const db = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
    await dbExport(db);
    db.end();
}
if (require.main === module) {
    main();
}
module.exports = dbExport;
