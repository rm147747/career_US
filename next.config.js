/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-markdown', 'remark-gfm']
};

module.exports = nextConfig;
