"use server";
import { createClient } from '@/lib/supabase/server';

/**
 * Login via Server Action
 */
export async function serverLogin(email: string, password: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid credentials") || msg.includes("password")) {
        return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
      }
      return { success: false, error: error.message };
    }
    
    if (!data.user) {
      return { success: false, error: "المستخدم غير موجود." };
    }
    
    return { success: true, userId: data.user.id };
  } catch (error: any) {
    console.error("Login error:", error);
    return { success: false, error: error?.message || "فشل تسجيل الدخول." };
  }
}

/**
 * Get current user from session
 */
export async function getServerUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { success: false, user: null };
    }
    
    const userData = {
      $id: user.id,
      name: user.user_metadata?.name || '',
      email: user.email,
      registration: user.created_at,
    };
    
    return { success: true, user: userData };
  } catch {
    return { success: false, user: null };
  }
}

/**
 * Logout
 */
export async function serverLogout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch {
    return { success: true };
  }
}

/**
 * Update user name
 */
export async function updateNameServer(name: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      data: { name }
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Change password
 */
export async function changePasswordServer(newPassword: string, oldPassword?: string) {
  try {
    const supabase = await createClient();
    // Note: Supabase doesn't require old password by default if the user is authenticated,
    // but you might need to handle reauthentication for security in production.
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
