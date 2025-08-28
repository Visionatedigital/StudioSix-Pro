/**
 * Manual Authentication Service
 * Bypasses Supabase email confirmation by managing user verification locally
 * Now integrates with subscription system
 */

import userDatabaseService from './UserDatabaseService';

class ManualAuthService {
  constructor() {
    this.storageKey = 'studiosix_manual_verified_users';
    this.currentUserKey = 'studiosix_current_user';
  }

  // Get all manually verified users
  getVerifiedUsers() {
    try {
      const users = localStorage.getItem(this.storageKey);
      return users ? JSON.parse(users) : {};
    } catch {
      return {};
    }
  }

  // Add a user to the manually verified list
  addVerifiedUser(email, userData = {}) {
    const verifiedUsers = this.getVerifiedUsers();
    verifiedUsers[email] = {
      email,
      verified: true,
      verifiedAt: Date.now(),
      verifiedBy: 'manual',
      ...userData
    };
    localStorage.setItem(this.storageKey, JSON.stringify(verifiedUsers));
    console.log('✅ User manually verified:', email);
  }

  // Check if user is manually verified
  isUserVerified(email) {
    const verifiedUsers = this.getVerifiedUsers();
    return !!verifiedUsers[email];
  }

  // Remove user from verified list
  removeVerifiedUser(email) {
    const verifiedUsers = this.getVerifiedUsers();
    delete verifiedUsers[email];
    localStorage.setItem(this.storageKey, JSON.stringify(verifiedUsers));
    console.log('❌ User removed from manual verification:', email);
  }

  // Set current authenticated user (bypass Supabase session)
  setCurrentUser(userData) {
    localStorage.setItem(this.currentUserKey, JSON.stringify({
      ...userData,
      manualAuth: true,
      authenticatedAt: Date.now()
    }));
    console.log('🔐 Manual user session set:', userData.email);
  }

  // Get current authenticated user
  getCurrentUser() {
    try {
      const user = localStorage.getItem(this.currentUserKey);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  // Clear current user session
  clearCurrentUser() {
    localStorage.removeItem(this.currentUserKey);
    console.log('🔐 Manual user session cleared');
  }

  // Manual signin (bypasses Supabase entirely)
  async manualSignIn(email, password) {
    console.log('🔐 Attempting manual signin for:', email);
    
    // Check if user is manually verified
    if (!this.isUserVerified(email)) {
      return {
        success: false,
        error: 'User not manually verified. Please contact administrator.'
      };
    }

    // Create a mock user object
    const userData = {
      id: `manual_${email}`,
      email,
      user_metadata: {
        full_name: email.split('@')[0],
        manual_auth: true
      },
      app_metadata: {
        provider: 'manual',
        verified: true
      }
    };

    // Set as current user
    this.setCurrentUser(userData);

    // Initialize subscription profile in database
    try {
      console.log('📊 Initializing subscription profile for manual user...');
      await userDatabaseService.getUserProfile(userData.id);
    } catch (error) {
      console.warn('⚠️ Could not initialize subscription profile:', error);
    }

    return {
      success: true,
      data: {
        user: userData,
        session: {
          access_token: `manual_token_${Date.now()}`,
          user: userData,
          manual: true
        }
      }
    };
  }

  // Pre-verify common test emails
  initializeTestUsers() {
    const testUsers = [
      'test@example.com',
      'admin@studiosix.com',
      'demo@studiosix.com',
      'user@test.com'
    ];

    testUsers.forEach(email => {
      if (!this.isUserVerified(email)) {
        this.addVerifiedUser(email, {
          firstName: email.split('@')[0],
          isTestUser: true
        });
      }
    });

    console.log('🧪 Test users initialized:', testUsers);
  }

  // Admin function to manually verify any email
  adminVerifyUser(email) {
    this.addVerifiedUser(email, {
      firstName: email.split('@')[0] || 'User',
      verifiedBy: 'admin'
    });
    return true;
  }

  // Get verification status for debugging
  getVerificationStatus(email) {
    const verifiedUsers = this.getVerifiedUsers();
    const user = verifiedUsers[email];
    
    return {
      email,
      isVerified: !!user,
      verificationData: user || null,
      allVerifiedEmails: Object.keys(verifiedUsers)
    };
  }
}

// Create singleton instance
const manualAuthService = new ManualAuthService();

// Initialize test users on startup
manualAuthService.initializeTestUsers();

export default manualAuthService; 