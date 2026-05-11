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
 * Verifies credentials using Admin SDK, stores user info in cookie.
 */
export async function serverLogin(email: string, password: string) {
  try {
    // Use Admin SDK to list users and verify by email
    const users = new Users(getAdminClient());
    
    // First verify the email/password by creating a session via anonymous client
    const anonClient = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId);
    
    const account = new Account(anonClient);
    
    let session;
    try {
      session = await account.createEmailPasswordSession(email, password);
    } catch (loginErr: any) {
      const msg = loginErr?.message || "";
      if (msg.includes("Invalid credentials") || msg.includes("password") || msg.includes("user_invalid_credentials")) {
        return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
      }
      throw loginErr;
    }
    
    // Get user info using Admin SDK
    const userList = await users.list([`email("${email}")`]);
    const userDoc = userList.users[0];
    
    if (!userDoc) {
      return { success: false, error: "المستخدم غير موجود." };
    }
    
    // Store session info in cookies on Vercel domain
    const cookieStore = await cookies();
    
    // Store session secret for API calls that need user context
    cookieStore.set('appwrite_session', session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    
    // Store user data directly in cookie (so we don't need to call Appwrite to check auth)
    const userData = JSON.stringify({
      $id: userDoc.$id,
      name: userDoc.name,
      email: userDoc.email,
      registration: userDoc.registration,
    });
    
    cookieStore.set('user_data', userData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    
    return { success: true, userId: userDoc.$id };
  } catch (error: any) {
    console.error("Login error:", error);
    return { success: false, error: error?.message || "فشل تسجيل الدخول." };
  }
}

/**
 * Get current user from cookie - NO Appwrite call needed for basic check.
 */
export async function getServerUser() {
  try {
    const cookieStore = await cookies();
    const userData = cookieStore.get('user_data')?.value;
    
    if (!userData) {
      return { success: false, user: null };
    }
    
    try {
      const user = JSON.parse(userData);
      return { success: true, user };
    } catch {
      return { success: false, user: null };
    }
  } catch {
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
      try {
        const client = new Client()
          .setEndpoint(config.appwriteUrl)
          .setProject(config.projectId)
          .setSession(sessionSecret);
        const account = new Account(client);
        await account.deleteSession('current');
      } catch {}
    }
    
    cookieStore.delete('appwrite_session');
    cookieStore.delete('user_data');
    
    return { success: true };
  } catch {
    return { success: true };
  }
}

/**
 * Update user name - server-side using session.
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
    
    // Update cached user data
    const userData = cookieStore.get('user_data')?.value;
    if (userData) {
      const user = JSON.parse(userData);
      user.name = name;
      cookieStore.set('user_data', JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Change password - server-side using session.
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
