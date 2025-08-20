"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorExtensions = void 0;
const Aside_1 = __importDefault(require("./extensions/Aside"));
const Image_1 = __importDefault(require("./extensions/Image"));
exports.editorExtensions = [
    Aside_1.default,
    Image_1.default,
];
