// import mysql from 'mysql2/promise';
// export abstract class BaseModel {
//   protected static connection = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     database: 'yourdb',
//     password: 'password',
//   });
//   protected static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
//     const [rows] = await this.connection.query(sql, params);
//     return rows as T[];
//   }
//   protected static async queryMany()
//   abstract save(): Promise<void>;
//   abstract delete(): Promise<void>;
// }
