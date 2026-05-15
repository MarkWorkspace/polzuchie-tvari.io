import type { NextConfig } from "next";
import os from "os";

// Функция автоматически получает ваш текущий IP в локальной сети (LAN)
const getLocalIps = () => {
  const ips: string[] = [];
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

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalIps(), // Разрешаем служебные WebSockets для LAN
};

export default nextConfig;
