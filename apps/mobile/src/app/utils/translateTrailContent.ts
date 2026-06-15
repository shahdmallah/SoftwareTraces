type TrailContentInput = {
  name: string;
  description?: string;
  region?: string;
  features?: string[];
};

export type ArabicTrailContent = {
  nameAr: string;
  descriptionAr?: string;
  regionAr?: string;
  featuresAr: string[];
};

const ARABIC_TEXT_PATTERN = /[\u0600-\u06FF]/;
const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

function hasArabicText(value: string) {
  return ARABIC_TEXT_PATTERN.test(value);
}

async function translateTextToArabic(value: string): Promise<string> {
  const text = value.trim();

  if (!text || hasArabicText(text)) {
    return text;
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: 'ar',
    dt: 't',
    q: text,
  });

  const response = await fetch(`${TRANSLATE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Translation failed with status ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const translated = Array.isArray(json)
    && Array.isArray(json[0])
    ? json[0]
        .map((part) => Array.isArray(part) && typeof part[0] === 'string' ? part[0] : '')
        .join('')
        .trim()
    : '';

  return translated || text;
}

async function translateOptionalText(value?: string) {
  const text = value?.trim();
  return text ? translateTextToArabic(text) : undefined;
}

export async function translateTrailContentToArabic(input: TrailContentInput): Promise<ArabicTrailContent> {
  try {
    const [nameAr, descriptionAr, regionAr, featuresAr] = await Promise.all([
      translateTextToArabic(input.name),
      translateOptionalText(input.description),
      translateOptionalText(input.region),
      Promise.all((input.features ?? []).map(translateTextToArabic)),
    ]);

    return {
      nameAr,
      descriptionAr,
      regionAr,
      featuresAr,
    };
  } catch (error) {
    console.warn('Trail Arabic translation failed:', error);

    return {
      nameAr: input.name.trim(),
      descriptionAr: input.description?.trim() || undefined,
      regionAr: input.region?.trim() || undefined,
      featuresAr: input.features ?? [],
    };
  }
}
