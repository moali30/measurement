const sdk = require("node-appwrite");
const c = new sdk.Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject("69b7fc49003cc7c030ae")
  .setKey("standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab");
const users = new sdk.Users(c);
users.create(sdk.ID.unique(), "admin@aems.app", undefined, "dinatalaat", "Admin")
  .then(r => console.log("Admin created:", r.$id))
  .catch(e => console.log("Error:", e.message));
