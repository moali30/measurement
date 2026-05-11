"use server";
import { Client, Users, ID } from 'node-appwrite';

import { config } from '@/lib/config';

export async function createUser(data: FormData) {
  const name = data.get("name") as string;
  const email = data.get("email") as string;
  const password = data.get("password") as string;

  try {
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setKey(process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab');

    const users = new Users(client);
    
    await users.create(ID.unique(), email, undefined, password, name);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function listUsers() {
  try {
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setKey(process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab');

    const users = new Users(client);
    const result = await users.list();
    // Only return serializable data
    return { success: true, users: result.users.map(u => ({ id: u.$id, name: u.name, email: u.email, registration: u.registration })) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
