"use server";
import { Client, Users, ID } from 'node-appwrite';

export async function createUser(data: FormData) {
  const name = data.get("name") as string;
  const email = data.get("email") as string;
  const password = data.get("password") as string;

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
      .setKey(process.env.APPWRITE_API_KEY || '');

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
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const users = new Users(client);
    const result = await users.list();
    // Only return serializable data
    return { success: true, users: result.users.map(u => ({ id: u.$id, name: u.name, email: u.email, registration: u.registration })) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
