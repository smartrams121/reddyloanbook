/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdfkit'],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
}

export default nextConfig
