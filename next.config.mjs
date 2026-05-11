/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules', '**/pagefile.sys', '**/hiberfil.sys', '**/swapfile.sys', 'D:/*.sys'],
      };
    }
    return config;
  },
};

export default nextConfig;
