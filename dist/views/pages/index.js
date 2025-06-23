"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = __importDefault(require("./misc"));
const user_1 = __importDefault(require("./user"));
const item_1 = __importDefault(require("./item"));
const story_1 = __importDefault(require("./story"));
const universe_1 = __importDefault(require("./universe"));
const pages = {
    misc: misc_1.default,
    user: user_1.default,
    item: item_1.default,
    story: story_1.default,
    universe: universe_1.default,
};
exports.default = pages;
