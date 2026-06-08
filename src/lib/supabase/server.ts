import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { config } from '../config'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export function createAdminClient() {
  return createServerClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {}
      }
    }
  )
}
