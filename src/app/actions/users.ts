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
      .setKey(process.env.APPWRITE_API_KEY || 'standard_f11ab7e4232ba688d25f054317b0604aa63631fa8431e8e503b3382560322812c4ddd2e0b3a8416c284f53f7a1ea2608c8f6eb7decad6dee859b49d8489fba75a69c20f0934bf74b89467e6fef4f0e3de2085801985b4da4c65248410312bdb7bd8d707723c6735c22cf84fb471e4ada9891a1145fed5142fb16b4cdb2d3c14b');

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
      .setKey(process.env.APPWRITE_API_KEY || 'standard_f11ab7e4232ba688d25f054317b0604aa63631fa8431e8e503b3382560322812c4ddd2e0b3a8416c284f53f7a1ea2608c8f6eb7decad6dee859b49d8489fba75a69c20f0934bf74b89467e6fef4f0e3de2085801985b4da4c65248410312bdb7bd8d707723c6735c22cf84fb471e4ada9891a1145fed5142fb16b4cdb2d3c14b');

    const users = new Users(client);
    const result = await users.list();
    // Only return serializable data
    return { success: true, users: result.users.map(u => ({ id: u.$id, name: u.name, email: u.email, registration: u.registration })) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
