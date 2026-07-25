/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import { createAdminClient } from '@/lib/supabase/server';

export async function createUser(data: FormData) {
  const name = data.get("name") as string;
  const email = data.get("email") as string;
  const password = data.get("password") as string;

  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function listUsers() {
  try {
    const supabase = createAdminClient();
    
    // We can list users using the admin API
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      return { success: false, error: error.message };
    }

    const users = data.users.map(u => ({
      id: u.id,
      name: u.user_metadata?.name || 'بدون اسم',
      email: u.email,
      registration: u.created_at
    }));

    return { success: true, users };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUserPassword(userId: string, newPassword: string) {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase.auth.admin.updateUserById(userId, {
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
