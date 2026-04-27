import path from 'path';
import { config as loadDotenv } from 'dotenv';
import appJson from './app.json';

loadDotenv({ path: path.resolve(__dirname, '.env') });

const expoConfig = appJson.expo;
const extra = 'extra' in expoConfig && expoConfig.extra ? expoConfig.extra : {};

export default {
  ...expoConfig,
  extra: {
    ...extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    apiPort: process.env.EXPO_PUBLIC_API_PORT ?? '3001',
  },
};
