// // services/UserService.ts
// import { UserModel } from '../models';
// import { validatePassword } from '../utils/auth';
// import { EmailClient } from '../infra/EmailClient';
// export class UserService {
//   constructor(
//     private sessionUser: { id: number },
//     private email: EmailClient,
//   ) {}
//   async deleteUser(username: string, password: string) {
//     const user = await UserModel.find(username);
//     if (!user) return { status: 404, data: null, error: 'Not found' };
//     if (this.sessionUser.id !== user.id) {
//       return { status: 403, data: null, error: "Can't delete someone else" };
//     }
//     if (!validatePassword(password, user.password, user.salt)) {
//       return { status: 403, data: null, error: "Incorrect password" };
//     }
//     await user.requestDeletion();
//     await this.email.sendTemplate('user-deletion', 'admin@example.com', { username });
//     return { status: 200, data: null };
//   }
// }
