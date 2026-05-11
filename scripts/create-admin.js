const sdk = require("node-appwrite");
const c = new sdk.Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject("6a011611000d48ca704b")
  .setKey("standard_f11ab7e4232ba688d25f054317b0604aa63631fa8431e8e503b3382560322812c4ddd2e0b3a8416c284f53f7a1ea2608c8f6eb7decad6dee859b49d8489fba75a69c20f0934bf74b89467e6fef4f0e3de2085801985b4da4c65248410312bdb7bd8d707723c6735c22cf84fb471e4ada9891a1145fed5142fb16b4cdb2d3c14b");
const users = new sdk.Users(c);
users.create(sdk.ID.unique(), "admin@aems.app", undefined, "dinatalaat", "Admin")
  .then(r => console.log("Admin created:", r.$id))
  .catch(e => console.log("Error:", e.message));
