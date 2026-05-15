import os from "os";

const getLocalIps = () => {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false, // Отключаем заголовок X-Powered-By для безопасности
  allowedDevOrigins: getLocalIps(), // Разрешаем служебные WebSockets для LAN
};

export default nextConfig;
