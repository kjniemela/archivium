"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = __importDefault(require("."));
const readline_1 = __importDefault(require("readline"));
const import_1 = require("./import");
const utils_1 = require("../api/utils");
const helpers_tsx_1 = require("../../editor/src/helpers.tsx");
async function main() {
    const items = await (0, utils_1.executeQuery)(`SELECT id, obj_data FROM item WHERE obj_data LIKE '%"body":%'`);
    const ans = await (0, import_1.askQuestion)(`Migrate all ${items.length} items in the database from markdown to JSON? [y/N] `);
    if (ans.toUpperCase() !== 'N') {
        console.log('Exiting.');
        return;
    }
    let skipped = 0;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`Converting... (${i}/${items.length})`);
        const objData = JSON.parse(item.obj_data);
        if (typeof objData.body === 'string') {
            const html = await (0, helpers_tsx_1.renderMarkdown)(universeShort, objData.body, { item: { ...data, obj_data: objData } });
            console.log(html);
            // objData.body = jsonBody;
            // await db.query('UPDATE item SET obj_data = ? WHERE id = ?', [JSON.stringify(objData), item.id]);
        }
        else {
            skipped++;
        }
        readline_1.default.moveCursor(process.stdout, 0, -1);
    }
    console.log(`Converting... (${users.length}/${users.length})`);
    console.log(`Done. Skipped ${skipped} items that were already in JSON format.`);
}
if (require.main === module) {
    main().then(() => _1.default.end());
}
