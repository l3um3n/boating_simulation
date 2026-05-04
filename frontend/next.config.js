/** @type {import('next').NextConfig} */
// Server-side proxy: /api/* on the frontend host is rewritten to BACKEND_URL.
// Local dev defaults to the uvicorn server on :8000. In production set
// BACKEND_URL to the deployed backend (e.g. https://boating-api.fly.dev) on
// the Vercel project's Environment Variables. Because the rewrite happens on
// the Next.js server, the browser sees same-origin requests and no CORS
// config is required on the backend.
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
