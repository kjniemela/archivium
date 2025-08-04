const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');
const { loadSchema } = require('./import');
async function main() {
    const db = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
    await loadSchema(db);
    db.end();
}
if (require.main === module) {
    main();
}
