"use server";

import { createAdminClient } from "@/lib/supabase/server";

export async function listSignaturesServer() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('signatures').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, signatures: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addSignatureServer(name: string, imageUrl: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('signatures').insert({ name, image_url: imageUrl }).select().single();
    if (error) throw error;
    return { success: true, signature: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSignatureServer(id: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('signatures').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
