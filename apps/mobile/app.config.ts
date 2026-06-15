import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import { config as loadDotenv } from 'dotenv';
import appJson from './app.json';

loadDotenv({ path: path.resolve(__dirname, '.env') });

const expoConfig = appJson.expo;
const extra = 'extra' in expoConfig && expoConfig.extra ? expoConfig.extra : {};
const extraRecord = extra as Record<string, unknown>;
const apiPort = process.env.EXPO_PUBLIC_API_PORT ?? '3001';
const wildlifeApiPort = process.env.EXPO_PUBLIC_WILDLIFE_API_PORT ?? '8000';
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || process.env.EAS_PROJECT_ID?.trim();
const googleServicesFile = './google-services.json';
const hasGoogleServicesFile = existsSync(path.resolve(__dirname, googleServicesFile));

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

function getWildlifeApiUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_WILDLIFE_API_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const explicitHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
  const host = explicitHost || getReachableLocalIp();
  return host ? `http://${host}:${wildlifeApiPort}` : '';
}

const apiUrl = getApiUrl();
const wildlifeApiUrl = getWildlifeApiUrl();

if (process.env.NODE_ENV !== 'production') {
  console.log(`[expo-config] API URL: ${apiUrl || 'auto-detect at runtime'}`);
  console.log(`[expo-config] Wildlife API URL: ${wildlifeApiUrl || 'derive from API URL at runtime'}`);
  console.log(`[expo-config] Android FCM config: ${hasGoogleServicesFile ? googleServicesFile : 'missing google-services.json'}`);
}

export default {
  ...expoConfig,
  android: {
    ...expoConfig.android,
    ...(hasGoogleServicesFile ? { googleServicesFile } : {}),
  },
  extra: {
    ...extraRecord,
    ...(easProjectId
      ? {
          eas: {
            ...(typeof extraRecord.eas === 'object' && extraRecord.eas !== null ? extraRecord.eas : {}),
            projectId: easProjectId,
          },
        }
      : {}),
    apiUrl,
    apiPort,
    wildlifeApiUrl,
    wildlifeApiPort,
  },
};
