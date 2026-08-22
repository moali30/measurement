/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "playwright-core"],
    outputFileTracingIncludes: {
      // The package loads these Brotli archives dynamically at runtime, so Next's
      // static tracer cannot discover them from the JavaScript imports alone.
      "/api/reports/analysis": [
        "./node_modules/@sparticuz/chromium/bin/**/*",
        // Arabic system font for Chromium's header/footer templates. Those
        // templates render in a separate document that inherits neither the
        // page's CSS nor its webfonts, and @sparticuz/chromium ships Open Sans
        // only -- which has no Arabic glyphs -- so without this the running
        // header and footer come out blank on the server.
        "./fonts/**/*",
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
