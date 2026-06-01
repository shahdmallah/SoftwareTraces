import path from 'path';
import os from 'os';
import { config as loadDotenv } from 'dotenv';
import appJson from './app.json';

loadDotenv({ path: path.resolve(__dirname, '.env') });

const expoConfig = appJson.expo;
const extra = 'extra' in expoConfig && expoConfig.extra ? expoConfig.extra : {};
const apiPort = process.env.EXPO_PUBLIC_API_PORT ?? '3001';

function isPrivateIpv4(address: string) {
  return (
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function getReachableLocalIp() {
  const interfaces = os.networkInterfaces();
  const ignoredAdapterName = /(virtual|vmware|virtualbox|hyper-v|wsl|loopback|bluetooth|tailscale|docker|vethernet)/i;
  const preferredAdapterName = /(wi-?fi|wireless|wlan|ethernet|local area connection)/i;
  const candidates: Array<{ name: string; address: string; preferred: boolean }> = [];

  Object.entries(interfaces).forEach(([name, entries]) => {
    if (!entries || ignoredAdapterName.test(name)) {
      return;
    }

    entries.forEach((entry) => {
      if (entry.family !== 'IPv4' || entry.internal || !isPrivateIpv4(entry.address)) {
        return;
      }

      candidates.push({
        name,
        address: entry.address,
        preferred: preferredAdapterName.test(name),
      });
    });
  });

  return (
    candidates.find((candidate) => candidate.preferred)?.address ??
    candidates[0]?.address ??
    ''
  );
}

function getApiUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const explicitHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
  const host = explicitHost || getReachableLocalIp();
  return host ? `http://${host}:${apiPort}` : '';
}

const apiUrl = getApiUrl();

if (process.env.NODE_ENV !== 'production') {
  console.log(`[expo-config] API URL: ${apiUrl || 'auto-detect at runtime'}`);
}

export default {
  ...expoConfig,
  extra: {
    ...extra,
    apiUrl,
    apiPort,
  },
};
plugins: [
  "expo-secure-store",
  // ...other plugins
]