"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModel = void 0;
const db_1 = __importDefault(require("../../db"));
class BaseModel {
    static async query(sql, params = []) {
        const [rows] = await db_1.default.execute(sql, params);
        return rows;
    }
    static async fetch(sql, params = [], condi) {
        const [rows] = await db_1.default.execute(sql, params);
        return rows;
    }
}
exports.BaseModel = BaseModel;
