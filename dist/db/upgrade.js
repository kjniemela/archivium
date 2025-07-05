const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');
const fs = require('fs').promises;
const path = require('path');
const { askQuestion } = require('./import');
const backup = require('./backup');
async function applySchemaPatches(db) {
    try {
        const [rows] = await db.query('SELECT version FROM schema_version');
        const currentVersion = rows[0].version || 0;
        console.log(`Current schema version: ${currentVersion}`);
        const patchDir = path.join(__dirname, 'patches');
        const files = await fs.readdir(patchDir);
        const patches = files
            .filter(file => /^patch_from_\d+\.sql$/.test(file))
            .map(file => {
            const fromVersion = parseInt(file.match(/^patch_from_(\d+)\.sql$/)[1], 10);
            return { file, fromVersion };
        })
            .filter(patch => patch.fromVersion >= currentVersion)
            .sort((a, b) => a.fromVersion - b.fromVersion);
        if (patches.length === 0) {
            console.log('No patches to apply. Schema is up to date.');
            return;
        }
        const ans = await askQuestion(`Backup ${DB_CONFIG.database} database first? [y/N] `);
        if (ans.toUpperCase() === 'Y') {
            await backup();
        }
        console.log(`Found ${patches.length} patches to apply.`);
        // 5. Apply patches
        for (const patch of patches) {
            const patchPath = path.join(patchDir, patch.file);
            const sql = await fs.readFile(patchPath, 'utf8');
            console.log(`Applying patch: ${patch.file}`);
            try {
                await db.beginTransaction();
                await db.query(sql);
                await db.commit();
                console.log(`Patch ${patch.file} applied successfully.`);
            }
            catch (err) {
                await db.rollback();
                console.error(`Error applying patch ${patch.file}:`, err);
                throw err;
            }
        }
        console.log('All patches applied successfully.');
    }
    catch (err) {
        console.error('Migration failed:', err);
    }
}
async function main() {
    const db = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
    await applySchemaPatches(db);
    db.end();
}
if (require.main === module) {
    main();
}
