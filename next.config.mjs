/** @type {import('next').NextConfig} */
const nextConfig = {
  // Port 3000 par défaut
  // Pour changer: next dev -p 3001
  
  // Configuration pour servir les fichiers uploadés
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
  
  // Images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
