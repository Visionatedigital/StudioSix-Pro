import { useState, useEffect, useContext, createContext } from 'react';
import { auth, isAuthConfigured } from '../config/supabase';
import resendEmailService from '../services/ResendEmailService';
import manualAuthService from '../services/ManualAuthService';

// Create auth context
const AuthContext = createContext({});

// Helper to manage confirmation codes in localStorage
const ConfirmationStorage = {
  key: 'studiosix_pending_confirmations',
  
  store(email, code, userData) {
    const confirmations = this.getAll();
    confirmations[email] = {
      code,
      userData,
      createdAt: Date.now(),
      attempts: 0
    };
    localStorage.setItem(this.key, JSON.stringify(confirmations));
  },
  
  get(email) {
    const confirmations = this.getAll();
    const confirmation = confirmations[email];
    
    // Check if expired (10 minutes)
    if (confirmation && Date.now() - confirmation.createdAt > 10 * 60 * 1000) {
      this.remove(email);
      return null;
    }
    
    return confirmation;
  },
  
  remove(email) {
    const confirmations = this.getAll();
    delete confirmations[email];
    localStorage.setItem(this.key, JSON.stringify(confirmations));
  },
  
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '{}');
    } catch {
      return {};
    }
  },
  
  incrementAttempts(email) {
    const confirmations = this.getAll();
    if (confirmations[email]) {
      confirmations[email].attempts = (confirmations[email].attempts || 0) + 1;
      localStorage.setItem(this.key, JSON.stringify(confirmations));
      return confirmations[email].attempts;
    }
    return 0;
  }
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        // First check for manual auth session
        const manualUser = manualAuthService.getCurrentUser();
        if (manualUser) {
          console.log('🔐 Found manual auth session:', manualUser.email);
          setUser(manualUser);
          setSession({ user: manualUser, manual: true });
          setLoading(false);
          return;
        }

        // Then check Supabase session
        const session = await auth.getCurrentSession();
        const user = await auth.getCurrentUser();
        
        setSession(session);
        setUser(user);
        
        console.log('🔐 Initial auth state:', { user: user?.email, session: !!session, manual: false });
      } catch (error) {
        console.error('Failed to get initial session:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes (only if Supabase is configured)
    if (isAuthConfigured) {
      const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Supabase auth state changed:', event, session?.user?.email);
        
        // Only update if we don't have a manual session
        const manualUser = manualAuthService.getCurrentUser();
        if (!manualUser) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        
        setLoading(false);
        
        if (event === 'SIGNED_OUT') {
          setError(null);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Sign in attempt for:', email);

      // First try manual auth if user is manually verified
      if (manualAuthService.isUserVerified(email)) {
        console.log('🔐 Using manual authentication for verified user');
        const result = await manualAuthService.manualSignIn(email, password);
        
        if (result.success) {
          setUser(result.data.user);
          setSession(result.data.session);
          console.log('✅ Manual sign in successful:', email);
          return { success: true, data: result.data };
        }
      }

      // Fall back to Supabase auth
      console.log('🔐 Trying Supabase authentication');
      const { data, error } = await auth.signIn(email, password);
      
      if (error) {
        // Handle Supabase-specific errors with helpful messages
        if (error.message?.includes('Invalid login credentials')) {
          // If Supabase fails, offer manual verification
          const verificationStatus = manualAuthService.getVerificationStatus(email);
          console.log('🔐 Supabase failed, verification status:', verificationStatus);
          
          if (!verificationStatus.isVerified) {
            throw new Error(`Invalid email or password. If you've completed email verification, the email address "${email}" can be manually verified. Contact support or use a test account.`);
          } else {
            throw new Error('Invalid password for manually verified account.');
          }
        } else if (error.message?.includes('Email not confirmed')) {
          // Automatically add to manual verification if email confirmation is the issue
          console.log('🔐 Email not confirmed in Supabase, adding to manual verification');
          manualAuthService.adminVerifyUser(email);
          
          // Try manual auth again
          const manualResult = await manualAuthService.manualSignIn(email, password);
          if (manualResult.success) {
            setUser(manualResult.data.user);
            setSession(manualResult.data.session);
            console.log('✅ Manual sign in successful after auto-verification:', email);
            return { success: true, data: manualResult.data };
          }
        }
        throw error;
      }
      
      console.log('✅ Supabase sign in successful:', data.user?.email);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password (keep existing ResendEmailService flow)
  const signUp = async (email, password, metadata = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Starting signup process for:', email);
      
      // Generate confirmation code
      const confirmationCode = resendEmailService.generateConfirmationCode();
      console.log('📱 Generated confirmation code:', confirmationCode);
      
      // Store pending confirmation data
      ConfirmationStorage.store(email, confirmationCode, {
        email,
        password,
        metadata
      });
      console.log('💾 Stored confirmation data in localStorage');
      
      // Send confirmation email
      console.log('📧 Attempting to send confirmation email...');
      const emailResult = await resendEmailService.sendConfirmationEmail(
        email, 
        confirmationCode, 
        metadata.firstName || metadata.full_name || ''
      );
      
      console.log('📧 Email service result:', emailResult);
      
      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send confirmation email');
      }
      
      console.log('✅ Signup initiated, confirmation email sent:', email);
      
      const result = { 
        success: true, 
        requiresConfirmation: true,
        email,
        message: emailResult.message
      };
      
      console.log('🔄 Returning signup result:', result);
      return result;
    } catch (error) {
      console.error('❌ Sign up failed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Verify email with confirmation code (enhanced with manual fallback)
  const verifyEmail = async (email, confirmationCode) => {
    try {
      setLoading(true);
      setError(null);
      
      const storedConfirmation = ConfirmationStorage.get(email);
      
      if (!storedConfirmation) {
        throw new Error('Confirmation code expired or not found. Please request a new one.');
      }
      
      // Check attempts limit
      if (storedConfirmation.attempts >= 5) {
        ConfirmationStorage.remove(email);
        throw new Error('Too many failed attempts. Please request a new confirmation code.');
      }
      
      // Verify code
      if (storedConfirmation.code !== confirmationCode) {
        ConfirmationStorage.incrementAttempts(email);
        throw new Error('Invalid confirmation code. Please try again.');
      }
      
      // Code is valid - now handle verification
      const { userData } = storedConfirmation;
      
      console.log('🔄 Email code verified, proceeding with account creation...');
      
      // Clear confirmation data since verification is complete
      ConfirmationStorage.remove(email);
      
      // Add to manual verification immediately
      manualAuthService.adminVerifyUser(userData.email);
      console.log('✅ User added to manual verification system');
      
      // Send welcome email
      try {
        await resendEmailService.sendWelcomeEmail(
          userData.email, 
          userData.metadata.firstName || userData.metadata.full_name || ''
        );
      } catch (emailError) {
        console.warn('⚠️ Welcome email failed (non-critical):', emailError);
      }
      
      // Try to create Supabase account (optional - for future compatibility)
      try {
        const { data: signUpData, error: signUpError } = await auth.signUp(
          userData.email, 
          userData.password, 
          userData.metadata
        );
        
        console.log('🔐 Supabase account creation attempt:', { 
          user: signUpData?.user?.email, 
          session: !!signUpData?.session,
          error: signUpError?.message 
        });
        
        // If Supabase signup succeeded and we got a session, use it
        if (signUpData?.session && signUpData?.user) {
          console.log('✅ Supabase signup successful with immediate session');
          return { success: true, data: signUpData, autoSignIn: true };
        }
      } catch (supabaseError) {
        console.warn('⚠️ Supabase account creation failed (using manual auth):', supabaseError);
      }
      
      // Use manual authentication as primary/fallback
      console.log('🔄 Using manual authentication system');
      const manualResult = await manualAuthService.manualSignIn(userData.email, userData.password);
      
      if (manualResult.success) {
        setUser(manualResult.data.user);
        setSession(manualResult.data.session);
        console.log('✅ Manual authentication successful after verification');
        return { success: true, data: manualResult.data, autoSignIn: true };
      }
      
      // If all else fails, account is verified but user needs to sign in manually
      return { 
        success: true, 
        data: { user: { email: userData.email } },
        autoSignIn: false,
        message: 'Account verified successfully! You can now sign in with your credentials.'
      };
      
    } catch (error) {
      console.error('❌ Email verification failed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Resend confirmation email (unchanged)
  const resendConfirmation = async (email) => {
    try {
      setLoading(true);
      setError(null);
      
      const storedConfirmation = ConfirmationStorage.get(email);
      
      if (!storedConfirmation) {
        throw new Error('No pending confirmation found. Please sign up again.');
      }
      
      // Generate new confirmation code
      const newConfirmationCode = resendEmailService.generateConfirmationCode();
      
      // Update stored confirmation with new code
      ConfirmationStorage.store(email, newConfirmationCode, storedConfirmation.userData);
      
      // Send new confirmation email
      const emailResult = await resendEmailService.sendConfirmationEmail(
        email, 
        newConfirmationCode, 
        storedConfirmation.userData.metadata.firstName || 
        storedConfirmation.userData.metadata.full_name || ''
      );
      
      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to resend confirmation email');
      }
      
      console.log('✅ Confirmation email resent:', email);
      return { 
        success: true, 
        message: emailResult.message
      };
    } catch (error) {
      console.error('❌ Failed to resend confirmation:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Google (unchanged)
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { data, error } = await auth.signInWithGoogle();
      
      if (error) throw error;
      
      console.log('✅ Google sign in initiated');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Google sign in failed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out (enhanced for manual auth)
  const signOut = async () => {
    try {
      setLoading(true);
      
      // Clear manual auth session
      manualAuthService.clearCurrentUser();
      
      // Clear Supabase session
      if (isAuthConfigured) {
        const { error } = await auth.signOut();
        if (error) throw error;
      }
      
      // Clear local state
      setUser(null);
      setSession(null);
      
      console.log('✅ User signed out (both manual and Supabase)');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    error,
    signIn,
    signUp,
    verifyEmail,
    resendConfirmation,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
    // Expose manual auth service for debugging
    manualAuthService,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth; 