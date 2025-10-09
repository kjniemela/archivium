"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = __importDefault(require("."));
const readline_1 = __importDefault(require("readline"));
const api_1 = __importDefault(require("../api"));
const import_1 = require("./import");
const utils_1 = require("../api/utils");
const errors_1 = require("../errors");
async function main() {
    console.log('Please input newletter info below:');
    const shortname = await (0, import_1.askQuestion)('Newsletter shortname: ');
    const preview = await (0, import_1.askQuestion)('Preview: ');
    console.log(`Shortname: ${shortname}`);
    console.log(`Preview: ${preview}`);
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
    const users = await api_1.default.user.getMany(null, true);
    const proceed = await (0, import_1.askQuestion)(`${users.length} users to send to, proceed? [y/N] `);
    if (proceed.toUpperCase() === 'N') {
        console.log('Exiting.');
        return;
    }
    const newsletter = await api_1.default.item.getByUniverseAndItemShortnames(undefined, 'archivium', shortname).catch((0, utils_1.handleAsNull)([errors_1.UnauthorizedError, errors_1.ForbiddenError]));
    if (!newsletter) {
        console.log('Newsletter not found or env is badly configured, exiting.');
        return;
    }
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`Sending... (${i}/${users.length})`);
        await api_1.default.notification.notify(user, api_1.default.notification.types.FEATURES, {
            title: newsletter.title,
            body: preview,
            clickUrl: `/news/${shortname}`,
        });
        readline_1.default.moveCursor(process.stdout, 0, -1);
    }
    console.log(`Sending... (${users.length}/${users.length})`);
}
if (require.main === module) {
    main().then(() => _1.default.end());
}
