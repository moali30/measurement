"use server";
import { Client, Account, Users } from 'node-appwrite';
import { cookies } from 'next/headers';
import { config } from '@/lib/config';

const API_KEY = process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab';

function getAdminClient() {
  return new Client()
    .setEndpoint(config.appwriteUrl)
    .setProject(config.projectId)
    .setKey(API_KEY);
}

/**
 * Login via Server Action - bypasses CORS completely.
 * Creates session server-side and stores in cookie.
 */
export async function serverLogin(email: string, password: string) {
  try {
    // Create a client WITHOUT API key to act as regular user
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId);
    
    const account = new Account(client);
    const session = await account.createEmailPasswordSession(email, password);
    
    // Store session secret in a secure cookie on Vercel domain
    const cookieStore = await cookies();
    cookieStore.set('appwrite_session', session.secret, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    // Also store user ID for quick access
    cookieStore.set('user_id', session.userId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    
    return { success: true, userId: session.userId };
  } catch (error: any) {
    const msg = error?.message || "";
    if (msg.includes("Invalid credentials") || msg.includes("password")) {
      return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    }
    return { success: false, error: msg || "فشل تسجيل الدخول." };
  }
}

/**
 * Get current user from session cookie - bypasses CORS.
 */
export async function getServerUser() {
  try {
    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get('appwrite_session')?.value;
    
    if (!sessionSecret) {
      return { success: false, user: null };
    }
    
    // Use session to authenticate
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setSession(sessionSecret);
    
    const account = new Account(client);
    const user = await account.get();
    
    return { 
      success: true, 
      user: {
        $id: user.$id,
        name: user.name,
        email: user.email,
        registration: user.registration,
      }
    };
  } catch (error: any) {
    // Session expired or invalid - clear cookies
    try {
      const cookieStore = await cookies();
      cookieStore.delete('appwrite_session');
      cookieStore.delete('user_id');
    } catch {}
    return { success: false, user: null };
  }
}

/**
 * Logout - clear session cookies.
 */
export async function serverLogout() {
  try {
    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get('appwrite_session')?.value;
    
    if (sessionSecret) {
      // Delete session from Appwrite
      try {
        const client = new Client()
          .setEndpoint(config.appwriteUrl)
          .setProject(config.projectId)
          .setSession(sessionSecret);
        const account = new Account(client);
        await account.deleteSession('current');
      } catch {}
    }
    
    // Clear cookies
    cookieStore.delete('appwrite_session');
    cookieStore.delete('user_id');
    
    return { success: true };
  } catch {
    return { success: true }; // Always succeed logout
  }
}

/**
 * Update user name - server-side.
 */
export async function updateNameServer(name: string) {
  try {
    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get('appwrite_session')?.value;
    if (!sessionSecret) return { success: false, error: "غير مسجل الدخول" };
    
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setSession(sessionSecret);
    
    const account = new Account(client);
    await account.updateName(name);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Change password - server-side.
 */
export async function changePasswordServer(newPassword: string, oldPassword: string) {
  try {
    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get('appwrite_session')?.value;
    if (!sessionSecret) return { success: false, error: "غير مسجل الدخول" };
    
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setSession(sessionSecret);
    
    const account = new Account(client);
    await account.updatePassword(newPassword, oldPassword);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
