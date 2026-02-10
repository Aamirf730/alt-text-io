/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.alt-text.pro',
      },
      {
        protocol: 'https',
        hostname: 'alt-text.pro',
      },
    ],
  },
};

export default nextConfig;

