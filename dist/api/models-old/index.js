"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = exports.RollbackError = void 0;
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
async function executeQuery(conn, sql, params = []) {
    const [rows] = await conn.execute(sql, params);
    return rows;
}
class RollbackError extends Error {
}
exports.RollbackError = RollbackError;
class Model {
    static TABLE;
    static query(sql, params = []) {
        return executeQuery(db_1.default, sql, params);
    }
    static async withTransaction(callback) {
        const connection = await db_1.default.getConnection();
        try {
            await connection.beginTransaction();
            await callback({
                connection,
                query(sql, params = []) {
                    return executeQuery(connection, sql, params);
                },
            });
            await connection.commit();
        }
        catch (err) {
            await connection.rollback();
            logger_1.default.warn('Transaction rolled back.');
            if (!(err instanceof RollbackError)) {
                throw err;
            }
        }
        finally {
            connection.release();
        }
    }
    static async insert(table, fields) {
        const keys = Object.keys(fields).filter(key => fields[key] !== undefined);
        const values = keys.map(key => fields[key]);
        const data = await db_1.default.execute(`
      INSERT INTO ${table}
      (${keys.join(', ')})
      VALUES (${keys.map(() => '?').join(', ')})
    `, values);
        const resultSetHeader = data[0];
        return resultSetHeader;
    }
    static async update(table, id, fields) {
        const keys = Object.keys(fields).filter(key => fields[key] !== undefined);
        const values = keys.map(key => fields[key]);
        const data = await db_1.default.execute(`
      UPDATE ${table}
      SET
        ${keys.map(key => `${key} = ?`).join(', ')}
      WHERE id = ?
    `, [...values, id]);
        console.log(data);
        const resultSetHeader = data[0];
        return resultSetHeader;
    }
    static parseConditions(conditions) {
        const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined);
        const values = keys.map(key => conditions[key]);
        const keyStr = keys.map(key => `${key} = ?`).join(' AND ');
        return [keyStr, values];
    }
}
exports.Model = Model;
