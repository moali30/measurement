import * as https from 'https';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function request(method: string, endpoint: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/auth/v1/admin${endpoint}`);
    const data = body ? JSON.stringify(body) : '';

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        ...(body ? { 'Content-Length': data.length } : {})
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData ? JSON.parse(responseData) : null);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  try {
    // 1. Get all users
    console.log('Fetching users...');
    const usersResponse = await request('GET', '/users');
    const users = usersResponse.users || usersResponse;
    const adminUser = users.find((u: any) => u.email === 'admin@aems.app');

    if (!adminUser) {
      console.log('User not found. Trying to create...');
      await request('POST', '/users', {
        email: 'admin@aems.app',
        password: 'password1234',
        email_confirm: true,
        user_metadata: { name: 'Admin' }
      });
      console.log('User created with password: password1234');
      return;
    }

    // 2. Update password
    console.log(`Updating password for user ${adminUser.id}...`);
    await request('PUT', `/users/${adminUser.id}`, {
      password: 'password1234',
      email_confirm: true
    });
    console.log('Password updated successfully to: password1234');
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
