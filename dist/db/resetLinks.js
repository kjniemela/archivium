const db = require(".");
const { handleLinks } = require("../api/models/item");
const { executeQuery } = require("../api/utils");
async function main() {
    await executeQuery('DELETE FROM itemlink');
    const items = await executeQuery(`
    SELECT item.id, item.obj_data, universe.shortname as universe_short
    FROM item
    INNER JOIN universe ON universe.id = item.universe_id
  `);
    for (const item of items) {
        const objData = JSON.parse(item.obj_data);
        if (objData.body) {
            await handleLinks(item, objData);
        }
    }
    db.end();
}
if (require.main === module) {
    main();
}
