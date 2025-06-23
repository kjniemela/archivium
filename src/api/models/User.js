// // models/User.ts
// import { BaseModel } from './BaseModel';
// export type UserJSON = {
//   id?: number,
//   username: string,
//   email: string,
//   password?: string,
//   salt?: string,
//   createdAt: Date,
//   updatedAt: Date
// };
// export class User extends BaseModel {
//   public id: number | null = null;
//   public username: string;
//   public email: string;
//   private password?: string;
//   private salt?: string;
//   public createdAt: Date;
//   public updatedAt: Date;
//   constructor(data: UserJSON) {
//     super();
//     this.id = data.id ?? null;
//     this.username = data.username;
//     this.email = data.email;
//     this.password = data.password;
//     this.salt = data.salt;
//     this.createdAt = data.createdAt ?? new Date();
//     this.updatedAt = data.updatedAt ?? new Date();
//   }
//   static async findById(id: number): Promise<User | null> {
//     const rows = await this.query(`SELECT * FROM users WHERE id = ?`, [id]);
//     if (rows.length === 0) return null;
//     return new User(rows[0]);
//   }
//   static async findAll(): Promise<User[]> {
//     const rows = await this.query(`SELECT * FROM users`);
//     return rows.map(row => new User(row));
//   }
//   async save(): Promise<void> {
//     if (this.id === null) {
//       const result = await BaseModel.query(`INSERT INTO users (username, email) VALUES (?, ?)`, [this.username, this.email]);
//       // you can get insertId from result if typed properly
//     } else {
//       await BaseModel.query(`UPDATE users SET username = ?, email = ? WHERE id = ?`, [this.username, this.email, this.id]);
//     }
//   }
//   async delete(): Promise<void> {
//     if (this.id !== null) {
//       await BaseModel.query(`DELETE FROM users WHERE id = ?`, [this.id]);
//     }
//   }
//   toJSON(): UserJSON {
//     return {
//       id: this.id ?? undefined,
//       username: this.username,
//       email: this.email,
//       password: this.password,
//       salt: this.salt,
//       createdAt: this.createdAt,
//       updatedAt: this.updatedAt,
//     };
//   }
// }
