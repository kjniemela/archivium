"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = void 0;
const db_1 = __importDefault(require("../../db"));
class Model {
    static TABLE;
    static async query(sql, params = []) {
        const [rows] = await db_1.default.execute(sql, params);
        return rows;
    }
    static async insert(table, fields) {
        const keys = Object.keys(fields).filter(key => fields[key] !== undefined);
        const values = keys.map(key => fields[key]);
        const data = await db_1.default.execute(`
      INSERT INTO ${table}
      (${keys.join(', ')})
      VALUES (${keys.map(() => '?').join(', ')})
    `, values);
        console.log(data);
        return data;
    }
    static parseConditions(conditions) {
        const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined);
        const values = keys.map(key => conditions[key]);
        const keyStr = keys.map(key => `${key} = ?`).join(' AND ');
        return [keyStr, values];
    }
}
exports.Model = Model;
