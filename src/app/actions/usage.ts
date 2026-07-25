/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createAdminClient } from "@/lib/supabase/server";

export async function getUsageStatsServer() {
  try {
    const supabase = createAdminClient();
    
    // Get counts
    const [{ count: formsCount }, { count: responsesCount }, { count: usersCount }, { count: signaturesCount }] = await Promise.all([
      supabase.from('forms').select('*', { count: 'exact', head: true }),
      supabase.from('responses').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('signatures').select('*', { count: 'exact', head: true })
    ]);

    // We can't query db size directly without an RPC, so we estimate based on rows.
    // forms ~ 2KB, responses ~ 1KB, users ~ 1KB, signatures ~ 100KB (base64 image)
    const estimatedFormsSize = (formsCount || 0) * 2;
    const estimatedResponsesSize = (responsesCount || 0) * 1;
    const estimatedUsersSize = (usersCount || 0) * 1;
    const estimatedSignaturesSize = (signaturesCount || 0) * 100;
    
    const totalEstimatedKb = estimatedFormsSize + estimatedResponsesSize + estimatedUsersSize + estimatedSignaturesSize;
    const totalEstimatedMb = (totalEstimatedKb / 1024).toFixed(2);

    return {
      success: true,
      stats: {
        forms: formsCount || 0,
        responses: responsesCount || 0,
        users: usersCount || 0,
        signatures: signaturesCount || 0,
        estimatedMb: parseFloat(totalEstimatedMb)
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
