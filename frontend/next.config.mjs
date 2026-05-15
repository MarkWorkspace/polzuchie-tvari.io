/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false, // Отключаем заголовок X-Powered-By для безопасности
};

export default nextConfig;