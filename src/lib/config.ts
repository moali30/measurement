export const config = {
  appwriteUrl: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
  storageBucketExcel: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_EXCEL || '',
  storageBucketQr: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_QR || '',
  storageBucketReports: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_REPORTS || '',
  storageBucketLogos: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_LOGOS || '',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
};
