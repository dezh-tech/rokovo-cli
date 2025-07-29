/**
 * User Service - Handles user registration, authentication, and profile management
 */

export interface User {
  id: string;
  email: string;
  username: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface UserRegistrationData {
  email: string;
  username: string;
  password: string;
}

export class UserService {
  private readonly MIN_PASSWORD_LENGTH = 8;
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly VERIFICATION_TIMEOUT_HOURS = 24;

  /**
   * Register a new user with validation
   * Business Rule: Email must be unique and valid format
   * Business Rule: Username must be 3-20 characters, alphanumeric only
   * Business Rule: Password must be at least 8 characters with special characters
   */
  async registerUser(data: UserRegistrationData): Promise<User> {
    // Email validation - must be unique and valid format
    if (!this.isValidEmail(data.email)) {
      throw new Error('Invalid email format. Please provide a valid email address.');
    }

    if (await this.emailExists(data.email)) {
      throw new Error('Email already registered. Please use a different email or try logging in.');
    }

    // Username validation - 3-20 characters, alphanumeric only
    if (!this.isValidUsername(data.username)) {
      throw new Error('Username must be 3-20 characters long and contain only letters and numbers.');
    }

    if (await this.usernameExists(data.username)) {
      throw new Error('Username already taken. Please choose a different username.');
    }

    // Password validation - minimum 8 characters with special characters
    if (!this.isValidPassword(data.password)) {
      throw new Error('Password must be at least 8 characters long and include at least one special character.');
    }

    const user = await this.createUser(data);
    
    // Send verification email - user has 24 hours to verify
    await this.sendVerificationEmail(user);
    
    return user;
  }

  /**
   * Authenticate user login
   * Business Rule: Account locked after 3 failed attempts
   * Business Rule: Unverified accounts cannot login after 24 hours
   */
  async loginUser(email: string, password: string): Promise<User> {
    const user = await this.findUserByEmail(email);
    
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // Check if account is locked due to failed attempts
    if (await this.isAccountLocked(user.id)) {
      throw new Error('Account temporarily locked due to multiple failed login attempts. Please try again in 30 minutes.');
    }

    // Verify password
    if (!await this.verifyPassword(password, user.id)) {
      await this.recordFailedAttempt(user.id);
      
      const attempts = await this.getFailedAttempts(user.id);
      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        await this.lockAccount(user.id);
        throw new Error('Account locked due to multiple failed login attempts. Please try again in 30 minutes.');
      }
      
      throw new Error(`Invalid email or password. ${this.MAX_LOGIN_ATTEMPTS - attempts} attempts remaining.`);
    }

    // Check email verification status
    if (!user.isVerified) {
      const hoursSinceRegistration = this.getHoursSinceRegistration(user.createdAt);
      if (hoursSinceRegistration > this.VERIFICATION_TIMEOUT_HOURS) {
        throw new Error('Account verification expired. Please register again or contact support.');
      }
      throw new Error('Please verify your email address before logging in. Check your inbox for the verification link.');
    }

    // Clear failed attempts on successful login
    await this.clearFailedAttempts(user.id);
    
    return user;
  }

  /**
   * Update user profile
   * Business Rule: Users can only update their own profile
   * Business Rule: Email changes require re-verification
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.findUserById(userId);
    
    if (!user) {
      throw new Error('User not found.');
    }

    // If email is being changed, require re-verification
    if (updates.email && updates.email !== user.email) {
      if (!this.isValidEmail(updates.email)) {
        throw new Error('Invalid email format.');
      }
      
      if (await this.emailExists(updates.email)) {
        throw new Error('Email already in use by another account.');
      }
      
      // Mark as unverified and send new verification email
      updates.isVerified = false;
      const updatedUser = await this.updateUser(userId, updates);
      await this.sendVerificationEmail(updatedUser);
      
      return updatedUser;
    }

    return await this.updateUser(userId, updates);
  }

  /**
   * Delete user account
   * Business Rule: Account deletion is permanent and immediate
   * Business Rule: All user data is removed within 30 days
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.findUserById(userId);
    
    if (!user) {
      throw new Error('User not found.');
    }

    // Schedule data deletion (GDPR compliance)
    await this.scheduleDataDeletion(userId);
    
    // Immediately deactivate account
    await this.deactivateUser(userId);
  }

  // Private validation methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  private isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
    return usernameRegex.test(username);
  }

  private isValidPassword(password: string): boolean {
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      return false;
    }
    
    // Must contain at least one special character
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    return specialCharRegex.test(password);
  }

  private getHoursSinceRegistration(createdAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  // Database methods (implementation would depend on your database)
  private async emailExists(email: string): Promise<boolean> {
    // Implementation would check database
    return false;
  }

  private async usernameExists(username: string): Promise<boolean> {
    // Implementation would check database
    return false;
  }

  private async createUser(data: UserRegistrationData): Promise<User> {
    // Implementation would create user in database
    return {
      id: 'user-123',
      email: data.email,
      username: data.username,
      isVerified: false,
      createdAt: new Date()
    };
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    // Implementation would query database
    return null;
  }

  private async findUserById(id: string): Promise<User | null> {
    // Implementation would query database
    return null;
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    // Implementation would send email
  }

  private async isAccountLocked(userId: string): Promise<boolean> {
    // Implementation would check lock status
    return false;
  }

  private async verifyPassword(password: string, userId: string): Promise<boolean> {
    // Implementation would verify hashed password
    return false;
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    // Implementation would record failed attempt
  }

  private async getFailedAttempts(userId: string): Promise<number> {
    // Implementation would get failed attempt count
    return 0;
  }

  private async lockAccount(userId: string): Promise<void> {
    // Implementation would lock account
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    // Implementation would clear failed attempts
  }

  private async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    // Implementation would update user in database
    return {} as User;
  }

  private async scheduleDataDeletion(userId: string): Promise<void> {
    // Implementation would schedule data deletion
  }

  private async deactivateUser(userId: string): Promise<void> {
    // Implementation would deactivate user
  }
}
