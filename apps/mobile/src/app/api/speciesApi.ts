import axios, { type AxiosResponse } from 'axios';
import Constants from 'expo-constants';

import { getApiBaseUrl } from '../lib/auth';
import type { ReactNativeFile } from './mediaApi';

export type SpeciesPrediction = {
  name: string;
  commonName?: string;
  scientificName?: string;
  label?: string;
  confidence: number;
};

export type SpeciesTaxonomy = {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
};

export type SpeciesIdentification = {
  commonName: string;
  scientificName: string;
  shortDescription: string;
  confidenceLevel: number;
  taxonomy: SpeciesTaxonomy;
  notableFeatures: string[];
  ecologicalRole?: string;
  funFacts?: string[];
};

export type SpeciesLanguage = 'en' | 'ar';

type PredictResponse = {
  top5: SpeciesPrediction[];
};

type IdentifyResponse = {
  result: SpeciesIdentification;
  top5: SpeciesPrediction[];
  source: 'google-ai';
  language?: SpeciesLanguage;
  isFallback: boolean;
  fallbackReason?: string;
};

function getExpoExtraWildlifeApiUrl() {
  const candidates = [
    Constants.expoConfig?.extra?.wildlifeApiUrl,
    (Constants.manifest as { extra?: { wildlifeApiUrl?: unknown } } | null)?.extra?.wildlifeApiUrl,
    (Constants.manifest2 as { extra?: { wildlifeApiUrl?: unknown } } | null)?.extra?.wildlifeApiUrl,
    (
      Constants.manifest2 as {
        extra?: { expoClient?: { extra?: { wildlifeApiUrl?: unknown } } };
      } | null
    )?.extra?.expoClient?.extra?.wildlifeApiUrl,
    process.env.EXPO_PUBLIC_WILDLIFE_API_URL,
  ];

  const resolved = candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  return typeof resolved === 'string' ? resolved.trim() : '';
}

function getExpoExtraWildlifeApiPort() {
  const candidates = [
    Constants.expoConfig?.extra?.wildlifeApiPort,
    (Constants.manifest as { extra?: { wildlifeApiPort?: unknown } } | null)?.extra?.wildlifeApiPort,
    (Constants.manifest2 as { extra?: { wildlifeApiPort?: unknown } } | null)?.extra?.wildlifeApiPort,
    (
      Constants.manifest2 as {
        extra?: { expoClient?: { extra?: { wildlifeApiPort?: unknown } } };
      } | null
    )?.extra?.expoClient?.extra?.wildlifeApiPort,
    process.env.EXPO_PUBLIC_WILDLIFE_API_PORT,
  ];

  const resolved = candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  return typeof resolved === 'string' ? resolved.trim() : '8000';
}

function getSpeciesBaseUrl() {
  const explicitUrl = getExpoExtraWildlifeApiUrl();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '');
  }

  const apiUrl = new URL(getApiBaseUrl());
  apiUrl.port = getExpoExtraWildlifeApiPort();
  apiUrl.pathname = '';
  apiUrl.search = '';
  apiUrl.hash = '';
  return apiUrl.toString().replace(/\/$/, '');
}

function getWildlifeReachabilityMessage(baseUrl: string) {
  return `Unable to reach the wildlife server at ${baseUrl}. Check your local IP and port 8000.`;
}

export async function identifySpecies(file: ReactNativeFile, language: SpeciesLanguage = 'en') {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  formData.append('language', language);

  const baseUrl = getSpeciesBaseUrl();
  let response: AxiosResponse<PredictResponse>;

  try {
    response = await axios.post<PredictResponse>(`${baseUrl}/predict`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new Error(getWildlifeReachabilityMessage(baseUrl));
      }

      const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
      throw new Error(typeof detail === 'string' ? detail : 'Species identification failed.');
    }

    throw error;
  }

  return response.data.top5;
}

export async function identifySpeciesDetails(file: ReactNativeFile, language: SpeciesLanguage = 'en') {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  formData.append('language', language);

  const baseUrl = getSpeciesBaseUrl();
  let response: AxiosResponse<IdentifyResponse>;

  try {
    response = await axios.post<IdentifyResponse>(`${baseUrl}/identify`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new Error(getWildlifeReachabilityMessage(baseUrl));
      }

      const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
      throw new Error(typeof detail === 'string' ? detail : 'Species identification failed.');
    }

    throw error;
  }

  return response.data;
}
