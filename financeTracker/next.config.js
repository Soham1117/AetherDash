const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Disable in dev for faster refresh
  register: false, // Manual registration in app/register-sw.tsx
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {}, // Empty turbopack config to silence webpack warning
};

module.exports = withPWA(nextConfig);
