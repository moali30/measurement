import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APPWRITE_URL = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_KEY = process.env.APPWRITE_API_KEY!;
const APPWRITE_DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const appwrite = new AppwriteClient().setEndpoint(APPWRITE_URL).setProject(APPWRITE_PROJECT).setKey(APPWRITE_KEY);
const databases = new Databases(appwrite);

async function check() {
  const { documents } = await databases.listDocuments(APPWRITE_DB, 'response_answers', [Query.limit(2)]);
  console.log("Appwrite Answers sample:", documents);
}
check();
