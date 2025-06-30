// models/User.ts
import { NotFoundError, ValidationError } from '../../../errors';
import { Model } from '.';
import { createRandom32String } from '../../../lib/hashUtils';

export type UserJSON = {
  id?: number,
  username: string,
  email: string,
  password?: string,
  salt?: string,
  created_at?: Date,
  updated_at?: Date
};

export class UserModel extends Model {
  static readonly TABLE: string = 'user';

  public id: number | null = null;
  public username: string;
  public email: string;
  private password?: string;
  private salt?: string;
  public created_at: Date;
  public updated_at: Date;

  public static validateUsername(username: string): string | null {
    const RESERVED_USERNAMES = ['admin', 'moderator', 'root', 'support', 'system'];
  
    if (username.length < 3 || username.length > 32) {
      return 'Username must be between 3 and 32 characters long.';
    }
  
    if (RESERVED_USERNAMES.includes(username)) {
        return 'This username is reserved and cannot be used.';
    }
  
    if (/^\d+$/.test(username)) {
        return 'Usernames cannot be only numbers.';
    }
  
    if (/[-_]{2,}/.test(username)) {
      return 'Usernames cannot have consecutive dashes or underscores.';
    }
  
    if (/^[-]|[-]$/.test(username)) {
      return 'Usernames cannot start or end with a dash.';
    }
  
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return 'Usernames can only contain letters, numbers, underscores, and hyphens.';
    }
  
    return null;
  }

  constructor(data: UserJSON) {
    super();
    this.id = data.id ?? null;
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.salt = data.salt;
    this.created_at = data.created_at ?? new Date();
    this.updated_at = data.updated_at ?? new Date();
  }

  public static async find(conds: Partial<UserJSON>): Promise<UserModel | null> {
    const rows = await UserModel.findAll(conds);
    if (rows.length === 0) return null;
    return rows[0];
  }

  public static async findOrThrow(conds: Partial<UserJSON>): Promise<UserModel> {
    const user = await UserModel.find(conds);
    if (!user) {
      throw new NotFoundError();
    }
    return user;
  }

  public static async findAll(conds: Partial<UserJSON> = {}): Promise<UserModel[]> {
    const [str, values] = Model.parseConditions(conds);
    const rows = await Model.query<UserJSON>(`SELECT * FROM ${UserModel.TABLE} WHERE ${str}`, values);
    return rows.map(row => new UserModel(row));
  }

  public async save(): Promise<void> {
    if (this.id === null) {
      const validationError = UserModel.validateUsername(this.username);
      if (validationError) {
        throw new ValidationError(validationError);
      }
      if (!this.password) {
        throw new ValidationError('Password is required when creating new user.');
      }
      this.salt = createRandom32String();
      const { insertId } = await Model.insert(UserModel.TABLE, this.toJSON());
      this.id = insertId;
    } else {
      await Model.update(UserModel.TABLE, this.id, this.toJSON());
    }
  }

  public async delete(): Promise<void> {
    if (this.id !== null) {
      await Model.query(`DELETE FROM ${UserModel.TABLE} WHERE id = ?`, [this.id]);
    }
  }

  public toJSON(): UserJSON {
    return {
      id: this.id ?? undefined,
      username: this.username,
      email: this.email,
      password: this.password,
      salt: this.salt,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
