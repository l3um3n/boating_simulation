/** @type {import('next').NextConfig} */
// In dev, proxy /api/* to the local FastAPI (uvicorn on :8000) so we avoid
// CORS. In production (Vercel), the Python serverless function at
// `/api/index.py` handles /api/* directly and Next.js shouldn't intercept.
const isDev = process.env.NODE_ENV !== "production";
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
