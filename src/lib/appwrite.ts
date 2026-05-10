import { Client, Account, Databases, Storage, Teams, Functions } from "appwrite";
import { config } from "./config";

const client = new Client()
  .setEndpoint(config.appwriteUrl)
  .setProject(config.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const teams = new Teams(client);
export const functions = new Functions(client);
export { client };
