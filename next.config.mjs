/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    serverComponentsExternalPackages: ['pdfkit'],
  },
}

export default nextConfig
