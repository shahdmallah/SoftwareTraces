import axios, { type AxiosResponse } from 'axios';

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

function getSpeciesBaseUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_WILDLIFE_API_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '');
  }

  const apiUrl = new URL(getApiBaseUrl());
  apiUrl.port = '8000';
  apiUrl.pathname = '';
  apiUrl.search = '';
  apiUrl.hash = '';
  return apiUrl.toString().replace(/\/$/, '');
}

export async function identifySpecies(file: ReactNativeFile, language: SpeciesLanguage = 'en') {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  formData.append('language', language);

  let response: AxiosResponse<PredictResponse>;

  try {
    response = await axios.post<PredictResponse>(`${getSpeciesBaseUrl()}/predict`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new Error('Unable to reach the wildlife server. Check your local IP and port 8000.');
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

  let response: AxiosResponse<IdentifyResponse>;

  try {
    response = await axios.post<IdentifyResponse>(`${getSpeciesBaseUrl()}/identify`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new Error('Unable to reach the wildlife server. Check your local IP and port 8000.');
      }

      const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
      throw new Error(typeof detail === 'string' ? detail : 'Species identification failed.');
    }

    throw error;
  }

  return response.data;
}
