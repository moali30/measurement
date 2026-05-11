// Setup script to create Appwrite database, collections, and buckets
const sdk = require("node-appwrite");

const client = new sdk.Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject("69b7fc49003cc7c030ae")
  .setKey("standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab");

const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);

const DB_ID = "aems_db";

async function setup() {
  console.log("🚀 Setting up AEMS on Appwrite...\n");

  // 1. Create Database
  try {
    await databases.create(DB_ID, "AEMS Database");
    console.log("✅ Database created: aems_db");
  } catch (e) {
    if (e.code === 409 || e.code === 403) console.log("⏭️  Database already exists or limit reached, continuing...");
    else throw e;
  }

  // 2. Create Collections
  const collections = [
    {
      id: "universities",
      name: "Universities",
      attrs: [
        { key: "name", type: "string", size: 255, required: true },
        { key: "nameEn", type: "string", size: 255, required: false },
        { key: "logo", type: "string", size: 255, required: false },
        { key: "teamId", type: "string", size: 36, required: true },
        { key: "plan", type: "string", size: 50, required: false },
        { key: "createdAt", type: "string", size: 30, required: false },
      ],
    },
    {
      id: "colleges",
      name: "Colleges",
      attrs: [
        { key: "universityId", type: "string", size: 36, required: true },
        { key: "name", type: "string", size: 255, required: true },
        { key: "code", type: "string", size: 20, required: false },
        { key: "adminUserId", type: "string", size: 36, required: false },
      ],
    },
    {
      id: "departments",
      name: "Departments",
      attrs: [
        { key: "collegeId", type: "string", size: 36, required: true },
        { key: "name", type: "string", size: 255, required: true },
        { key: "code", type: "string", size: 20, required: false },
      ],
    },
    {
      id: "forms",
      name: "Forms",
      attrs: [
        { key: "title", type: "string", size: 500, required: true },
        { key: "description", type: "string", size: 2000, required: false },
        { key: "universityId", type: "string", size: 36, required: false },
        { key: "collegeId", type: "string", size: 36, required: false },
        { key: "departmentId", type: "string", size: 36, required: false },
        { key: "createdBy", type: "string", size: 36, required: true },
        { key: "status", type: "string", size: 20, required: true },
        { key: "slug", type: "string", size: 100, required: false },
        { key: "startDate", type: "string", size: 30, required: false },
        { key: "endDate", type: "string", size: 30, required: false },
        { key: "maxResponses", type: "integer", required: false },
        { key: "allowAnonymous", type: "boolean", required: false },
        { key: "preventDuplicate", type: "boolean", required: false },
        { key: "requireLogin", type: "boolean", required: false },
        { key: "confirmationMsg", type: "string", size: 500, required: false },
        { key: "qrFileId", type: "string", size: 36, required: false },
        { key: "responsesCount", type: "integer", required: false },
        { key: "teamId", type: "string", size: 36, required: false },
        { key: "createdAt", type: "string", size: 30, required: false },
        { key: "updatedAt", type: "string", size: 30, required: false },
      ],
    },
    {
      id: "form_sections",
      name: "Form Sections",
      attrs: [
        { key: "formId", type: "string", size: 36, required: true },
        { key: "title", type: "string", size: 500, required: true },
        { key: "description", type: "string", size: 1000, required: false },
        { key: "order", type: "integer", required: true },
      ],
    },
    {
      id: "questions",
      name: "Questions",
      attrs: [
        { key: "formId", type: "string", size: 36, required: true },
        { key: "sectionId", type: "string", size: 36, required: false },
        { key: "text", type: "string", size: 1000, required: true },
        { key: "type", type: "string", size: 30, required: true },
        { key: "required", type: "boolean", required: false },
        { key: "order", type: "integer", required: true },
        { key: "minLabel", type: "string", size: 100, required: false },
        { key: "maxLabel", type: "string", size: 100, required: false },
        { key: "minValue", type: "integer", required: false },
        { key: "maxValue", type: "integer", required: false },
      ],
      arrayAttrs: [
        { key: "options", size: 500, required: false },
        { key: "rows", size: 500, required: false },
        { key: "cols", size: 500, required: false },
      ],
    },
    {
      id: "responses",
      name: "Responses",
      attrs: [
        { key: "formId", type: "string", size: 36, required: true },
        { key: "respondentId", type: "string", size: 36, required: false },
        { key: "ipHash", type: "string", size: 64, required: false },
        { key: "submittedAt", type: "string", size: 30, required: true },
      ],
    },
    {
      id: "response_answers",
      name: "Response Answers",
      attrs: [
        { key: "responseId", type: "string", size: 36, required: true },
        { key: "questionId", type: "string", size: 36, required: true },
        { key: "formId", type: "string", size: 36, required: true },
        { key: "textValue", type: "string", size: 5000, required: false },
        { key: "numberValue", type: "float", required: false },
        { key: "fileId", type: "string", size: 36, required: false },
      ],
      arrayAttrs: [
        { key: "selectedOptions", size: 500, required: false },
      ],
    },
    {
      id: "students",
      name: "Students",
      attrs: [
        { key: "userId", type: "string", size: 36, required: false },
        { key: "studentId", type: "string", size: 50, required: true },
        { key: "name", type: "string", size: 255, required: true },
        { key: "email", type: "string", size: 255, required: false },
        { key: "universityId", type: "string", size: 36, required: false },
        { key: "departmentId", type: "string", size: 36, required: false },
        { key: "level", type: "integer", required: false },
        { key: "academicYear", type: "string", size: 20, required: false },
        { key: "teamId", type: "string", size: 36, required: false },
      ],
    },
    {
      id: "form_templates",
      name: "Form Templates",
      attrs: [
        { key: "name", type: "string", size: 255, required: true },
        { key: "nameAr", type: "string", size: 255, required: false },
        { key: "category", type: "string", size: 50, required: false },
        { key: "structure", type: "string", size: 100000, required: false },
        { key: "isGlobal", type: "boolean", required: false },
        { key: "universityId", type: "string", size: 36, required: false },
      ],
    },
  ];

  for (const col of collections) {
    try {
      await databases.createCollection(DB_ID, col.id, col.name, [
        sdk.Permission.read(sdk.Role.any()),
        sdk.Permission.create(sdk.Role.users()),
        sdk.Permission.update(sdk.Role.users()),
        sdk.Permission.delete(sdk.Role.users()),
      ]);
      console.log(`✅ Collection created: ${col.name}`);
    } catch (e) {
      if (e.code === 409) {
        console.log(`⏭️  Collection already exists: ${col.name}`);
      } else {
        console.error(`❌ Error creating ${col.name}:`, e.message);
        continue;
      }
    }

    // Create attributes
    for (const attr of col.attrs || []) {
      try {
        if (attr.type === "string") {
          await databases.createStringAttribute(DB_ID, col.id, attr.key, attr.size, attr.required, attr.default || undefined);
        } else if (attr.type === "integer") {
          await databases.createIntegerAttribute(DB_ID, col.id, attr.key, attr.required);
        } else if (attr.type === "float") {
          await databases.createFloatAttribute(DB_ID, col.id, attr.key, attr.required);
        } else if (attr.type === "boolean") {
          await databases.createBooleanAttribute(DB_ID, col.id, attr.key, attr.required);
        }
        console.log(`   ✅ Attribute: ${col.id}.${attr.key}`);
      } catch (e) {
        if (e.code === 409) console.log(`   ⏭️  Attribute exists: ${col.id}.${attr.key}`);
        else console.error(`   ❌ ${col.id}.${attr.key}:`, e.message);
      }
    }

    // Create string[] attributes
    for (const attr of col.arrayAttrs || []) {
      try {
        await databases.createStringAttribute(DB_ID, col.id, attr.key, attr.size, attr.required, undefined, true);
        console.log(`   ✅ Array Attribute: ${col.id}.${attr.key}`);
      } catch (e) {
        if (e.code === 409) console.log(`   ⏭️  Array Attribute exists: ${col.id}.${attr.key}`);
        else console.error(`   ❌ ${col.id}.${attr.key}:`, e.message);
      }
    }
  }

  // 3. Create indexes
  const indexes = [
    { col: "forms", key: "idx_status", attrs: ["status"] },
    { col: "forms", key: "idx_createdBy", attrs: ["createdBy"] },
    { col: "forms", key: "idx_slug", attrs: ["slug"] },
    { col: "forms", key: "idx_teamId", attrs: ["teamId"] },
    { col: "questions", key: "idx_formId", attrs: ["formId"] },
    { col: "questions", key: "idx_order", attrs: ["order"] },
    { col: "responses", key: "idx_formId", attrs: ["formId"] },
    { col: "response_answers", key: "idx_responseId", attrs: ["responseId"] },
    { col: "response_answers", key: "idx_formId", attrs: ["formId"] },
    { col: "response_answers", key: "idx_questionId", attrs: ["questionId"] },
    { col: "students", key: "idx_teamId", attrs: ["teamId"] },
    { col: "form_sections", key: "idx_formId", attrs: ["formId"] },
  ];

  // Wait for attributes to be available
  console.log("\n⏳ Waiting 5s for attributes to be indexed...");
  await new Promise((r) => setTimeout(r, 5000));

  for (const idx of indexes) {
    try {
      await databases.createIndex(DB_ID, idx.col, idx.key, "key", idx.attrs);
      console.log(`✅ Index created: ${idx.col}.${idx.key}`);
    } catch (e) {
      if (e.code === 409) console.log(`⏭️  Index exists: ${idx.col}.${idx.key}`);
      else console.error(`❌ Index ${idx.col}.${idx.key}:`, e.message);
    }
  }

  // 4. Create Storage Buckets
  const buckets = [
    { id: "excel_imports", name: "Excel Imports" },
    { id: "qr_codes", name: "QR Codes" },
    { id: "pdf_reports", name: "PDF Reports" },
    { id: "university_logos", name: "University Logos" },
  ];

  for (const bucket of buckets) {
    try {
      await storage.createBucket(bucket.id, bucket.name, [
        sdk.Permission.read(sdk.Role.any()),
        sdk.Permission.create(sdk.Role.users()),
        sdk.Permission.update(sdk.Role.users()),
        sdk.Permission.delete(sdk.Role.users()),
      ]);
      console.log(`✅ Bucket created: ${bucket.name}`);
    } catch (e) {
      if (e.code === 409) console.log(`⏭️  Bucket already exists: ${bucket.name}`);
      else console.error(`❌ Bucket ${bucket.name}:`, e.message);
    }
  }

  console.log("\n🎉 AEMS Appwrite setup complete!");
}

setup().catch(console.error);
