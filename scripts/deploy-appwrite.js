// Deploy to Appwrite Sites using REST API
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ENDPOINT = "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = "6a011611000d48ca704b";
const API_KEY = "standard_f11ab7e4232ba688d25f054317b0604aa63631fa8431e8e503b3382560322812c4ddd2e0b3a8416c284f53f7a1ea2608c8f6eb7decad6dee859b49d8489fba75a69c20f0934bf74b89467e6fef4f0e3de2085801985b4da4c65248410312bdb7bd8d707723c6735c22cf84fb471e4ada9891a1145fed5142fb16b4cdb2d3c14b";

const SITE_ID = "aems-site";

async function apiCall(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(ENDPOINT + endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": API_KEY,
      },
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function deploy() {
  console.log("🚀 Deploying AEMS to Appwrite Sites...\n");

  // Step 1: List frameworks to find Next.js key
  console.log("📋 Finding Next.js framework...");
  const frameworks = await apiCall("GET", "/sites/frameworks");
  
  if (frameworks.status !== 200) {
    console.error("❌ Could not list frameworks:", frameworks.data);
    console.log("\n⚠️  Appwrite Sites might not be available on your plan.");
    console.log("Please use the Appwrite Console to deploy manually:");
    console.log("1. Go to https://cloud.appwrite.io");
    console.log("2. Open your project → Sites");
    console.log("3. Create a new Site, select Next.js");
    console.log("4. Connect your GitHub repo or upload code");
    return;
  }

  let nextjsFramework = null;
  if (frameworks.data && frameworks.data.frameworks) {
    nextjsFramework = frameworks.data.frameworks.find(
      (f) => f.key && f.key.toLowerCase().includes("next")
    );
  }

  const frameworkKey = nextjsFramework ? nextjsFramework.key : "nextJs14";
  console.log(`✅ Framework: ${frameworkKey}\n`);

  // Step 2: Create Site
  console.log("🏗️  Creating site...");
  const createResult = await apiCall("POST", "/sites", {
    siteId: SITE_ID,
    name: "AEMS",
    framework: frameworkKey,
    buildRuntime: "node-22",
    adapter: "ssr",
    installCommand: "npm install",
    buildCommand: "npm run build",
    outputDirectory: ".next",
    timeout: 60,
    enabled: true,
    logging: true,
  });

  if (createResult.status === 201) {
    console.log("✅ Site created successfully!");
  } else if (createResult.status === 409) {
    console.log("⏭️  Site already exists, continuing...");
  } else {
    console.error("❌ Error creating site:", JSON.stringify(createResult.data, null, 2));
    return;
  }

  // Step 3: Set environment variables
  console.log("\n🔑 Setting environment variables...");
  const envVars = [
    { key: "NEXT_PUBLIC_APPWRITE_ENDPOINT", value: "https://fra.cloud.appwrite.io/v1" },
    { key: "NEXT_PUBLIC_APPWRITE_PROJECT_ID", value: PROJECT_ID },
    { key: "NEXT_PUBLIC_APPWRITE_DATABASE_ID", value: "aems_db" },
    { key: "NEXT_PUBLIC_APPWRITE_BUCKET_EXCEL", value: "excel_imports" },
    { key: "NEXT_PUBLIC_APPWRITE_BUCKET_QR", value: "qr_codes" },
    { key: "NEXT_PUBLIC_APPWRITE_BUCKET_REPORTS", value: "pdf_reports" },
    { key: "NEXT_PUBLIC_APPWRITE_BUCKET_LOGOS", value: "university_logos" },
    { key: "NEXT_PUBLIC_BASE_URL", value: "https://aems-site.appwrite.global" },
    { key: "APPWRITE_API_KEY", value: API_KEY },
  ];

  for (const env of envVars) {
    const result = await apiCall("POST", `/sites/${SITE_ID}/variables`, env);
    if (result.status === 201) {
      console.log(`   ✅ ${env.key}`);
    } else if (result.status === 409) {
      console.log(`   ⏭️  ${env.key} (exists)`);
    } else {
      console.log(`   ⚠️  ${env.key}: ${result.data.message || "error"}`);
    }
  }

  // Step 4: Build and deploy code
  console.log("\n📦 Building project locally...");
  try {
    execSync("npm run build", { cwd: process.cwd(), stdio: "inherit" });
  } catch {
    console.error("❌ Build failed");
    return;
  }

  // Step 5: Create tar.gz of the project
  console.log("\n📤 Packaging code for upload...");
  const tarFile = path.join(process.cwd(), "deploy.tar.gz");
  
  try {
    // Use tar to create archive (exclude node_modules and .next cache)
    execSync(
      `tar -czf deploy.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=.vercel --exclude=deploy.tar.gz .`,
      { cwd: process.cwd(), stdio: "inherit" }
    );
    console.log("✅ Code packaged");
  } catch {
    console.log("⚠️  tar not available, trying alternative...");
    console.log("\n📌 Please deploy manually via Appwrite Console:");
    console.log("   1. Go to: https://cloud.appwrite.io");
    console.log(`   2. Open project → Sites → ${SITE_ID}`);
    console.log("   3. Create deployment → Upload code");
    return;
  }

  // Step 6: Upload deployment
  console.log("\n🚀 Uploading deployment...");

  // Use multipart form upload via CLI since the REST API needs multipart
  try {
    const output = execSync(
      `npx appwrite-cli sites create-deployment --site-id ${SITE_ID} --code . --install-command "npm install" --build-command "npm run build" --output-directory ".next" --activate true`,
      { cwd: process.cwd(), stdio: "inherit", timeout: 300000 }
    );
    console.log("\n🎉 Deployment submitted! Check Appwrite Console for build status.");
  } catch (e) {
    console.log("\n⚠️  CLI upload failed. Trying manual approach...");
    console.log("\n📌 Deploy via Appwrite Console:");
    console.log("   1. Go to: https://cloud.appwrite.io");
    console.log(`   2. Open project → Sites`);
    console.log("   3. Select AEMS → Deployments → Create");
  }

  // Cleanup
  try {
    fs.unlinkSync(tarFile);
  } catch {}

  console.log("\n✅ Done!");
}

deploy().catch(console.error);
