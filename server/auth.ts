import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  username: string;
  password: string;
}

export interface LoginData {
  usernameOrEmail: string;
  password: string;
}

export class AuthService {
  private static generateUserId(): string {
    // Generate a UUID-like string for user ID
    return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  static async register(data: RegisterData): Promise<User> {
    // Check if username already exists
    const existingByUsername = await storage.getUserByUsername(data.username);
    if (existingByUsername) {
      throw new Error('Username is already taken');
    }

    // Check if email already exists
    const existingByEmail = await storage.getUserByEmail(data.email);
    if (existingByEmail) {
      throw new Error('Email is already registered');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const userId = this.generateUserId();
    const user = await storage.upsertUser({
      id: userId,
      email: data.email,
      phoneNumber: data.phoneNumber,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      authProvider: 'custom',
    });

    return user;
  }

  static async login(data: LoginData): Promise<User> {
    // Try to find user by email or username
    let user: User | undefined;
    
    if (data.usernameOrEmail.includes('@')) {
      // It's an email
      user = await storage.getUserByEmail(data.usernameOrEmail);
    } else {
      // It's a username
      user = await storage.getUserByUsername(data.usernameOrEmail);
    }

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.passwordHash) {
      throw new Error('This account uses external authentication');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    return user;
  }

  static async getUserById(id: string): Promise<User | undefined> {
    return await storage.getUser(id);
  }
}