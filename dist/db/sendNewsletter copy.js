"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = __importDefault(require("."));
const readline_1 = __importDefault(require("readline"));
const api_1 = __importDefault(require("../api"));
const import_1 = require("./import");
function askMultiline(query) {
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log(query);
    return new Promise(resolve => {
        let lines = [];
        let blankCount = 0;
        rl.on('line', line => {
            lines.push(line);
            if (!line) {
                blankCount++;
            }
            else {
                blankCount = 0;
            }
            if (blankCount === 2) {
                rl.close();
                lines.pop();
                resolve(lines.join('\n'));
            }
        });
    });
}
async function main() {
    console.log('Please input newletter info below:');
    const title = await (0, import_1.askQuestion)('Title: ');
    const preview = await (0, import_1.askQuestion)('Preview: ');
    const body = await askMultiline('Body:');
    console.log(`Title: ${title}`);
    console.log(`Preview: ${preview}`);
    console.log(`Body: ${body}`);
    const ans = await (0, import_1.askQuestion)('Does this look right? [y/N] ');
    if (ans.toUpperCase() === 'N') {
        const ans = await (0, import_1.askQuestion)('Try again? [y/N] ');
        if (ans.toUpperCase() === 'Y') {
            await main();
        }
        else {
            console.log('Exiting.');
        }
        return;
    }
    const { insertId } = await api_1.default.newsletter.post({ title, preview, body });
    const users = await api_1.default.user.getMany(null, true);
    const proceed = await (0, import_1.askQuestion)(`${users.length} users to send to, proceed? [y/N] `);
    if (proceed.toUpperCase() === 'N') {
        console.log('Exiting.');
        return;
    }
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`Sending... (${i}/${users.length})`);
        await api_1.default.notification.notify(user, api_1.default.notification.types.FEATURES, {
            title,
            body: preview,
            clickUrl: `/news/${insertId}`,
        });
        readline_1.default.moveCursor(process.stdout, 0, -1);
    }
    console.log(`Sending... (${users.length}/${users.length})`);
}
if (require.main === module) {
    main().then(() => _1.default.end());
}
