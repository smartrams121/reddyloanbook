/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    serverComponentsExternalPackages: ['pdfkit'],
  },
  async rewrites() {
    if (process.env.UPLOAD_DIR) {
      return [
        { source: '/uploads/:path*', destination: '/api/uploads/:path*' },
      ]
    }
    return []
  },
}

export default nextConfig
