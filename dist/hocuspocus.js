"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("@hocuspocus/server");
const api_1 = __importDefault(require("./api"));
const utils_1 = require("./api/utils");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
const server = new server_1.Server({
    name: "hocuspocus-archivium",
    port: config_1.HOCUSPOCUS_PORT,
    timeout: 30000,
    debounce: 5000,
    maxDebounce: 30000,
    quiet: true,
    async onAuthenticate(data) {
        const session = await api_1.default.session.getOne({ hash: data.token });
        const user = session?.user;
        const [type, ...args] = data.documentName.split('/');
        if (type === 'item') {
            const [universeShort, itemShort] = args;
            const item = await api_1.default.item.getByUniverseAndItemShortnames(user, universeShort, itemShort, utils_1.perms.WRITE, true);
        }
        else {
            throw new Error('Not Authorized!');
        }
    },
});
logger_1.default.info(`Starting hocuspocus server on port ${config_1.HOCUSPOCUS_PORT}...`);
server.listen();
