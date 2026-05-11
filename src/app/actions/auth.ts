"use server";
import { Client, Account } from 'node-appwrite';
import { config } from '@/lib/config';

const API_KEY = process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab';

/**
 * Server-side login: creates a session token that the client can use.
 * Bypasses CORS entirely - works on ALL devices.
 */
export async function serverLogin(email: string, password: string) {
  try {
    // Use Admin SDK to create a session for the user
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setKey(API_KEY);

    const account = new Account(client);
    
    // Create email/password session using Admin SDK
    const session = await account.createEmailPasswordSession(email, password);
    
    return { 
      success: true, 
      session: session.secret,
      userId: session.userId,
      expire: session.$createdAt,
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || "فشل تسجيل الدخول. يرجى التحقق من بياناتك."
    };
  }
}
