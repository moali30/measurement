/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "playwright-core"],
    outputFileTracingIncludes: {
      // The package loads these Brotli archives dynamically at runtime, so Next's
      // static tracer cannot discover them from the JavaScript imports alone.
      "/api/reports/analysis": [
        "./node_modules/@sparticuz/chromium/bin/**/*",
      ],
    },
  },
  webpack: (config, { dev }) => {
    config.resolve.alias.canvas = false;
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
