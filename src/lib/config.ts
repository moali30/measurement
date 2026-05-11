export const config = {
  appwriteUrl: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '69b7fc49003cc7c030ae',
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'aems_db',
  storageBucketExcel: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_EXCEL || 'excel_imports',
  storageBucketQr: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_QR || 'qr_codes',
  storageBucketReports: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_REPORTS || 'pdf_reports',
  storageBucketLogos: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_LOGOS || 'university_logos',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
};
