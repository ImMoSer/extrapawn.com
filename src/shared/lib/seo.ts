// src/shared/lib/seo.ts

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
}

const DEFAULT_TITLE = 'EXTRAPAWN — Professional Chess Training Ecosystem';
const DEFAULT_DESCRIPTION = 'The closed-loop chess gym for tournament players (1500+). Master openings, tactics, and endgames with human-like AI resistance.';
const DEFAULT_KEYWORDS = 'chess training, tournament preparation, chess gym, chess improvement';

export const updateSeo = (config: Partial<SeoConfig>) => {
  const title = config.title ? `${config.title} | EXTRAPAWN` : DEFAULT_TITLE;
  const description = config.description || DEFAULT_DESCRIPTION;
  const keywords = config.keywords || DEFAULT_KEYWORDS;

  // Update Title
  document.title = title;

  // Update Meta Description
  let metaDescription = document.querySelector('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.setAttribute('name', 'description');
    document.head.appendChild(metaDescription);
  }
  metaDescription.setAttribute('content', description);

  // Update Meta Keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.setAttribute('content', keywords);

  // Update OG/Twitter Title & Description
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', title);

  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', description);

  const twitterDescription = document.querySelector('meta[name="twitter:description"]');
  if (twitterDescription) twitterDescription.setAttribute('content', description);
};

export interface RouteMetaWithSeo {
  seo?: {
    titleKey?: string;
    descriptionKey?: string;
    keywordsKey?: string;
  };
  [key: string]: unknown;
}

export const updateSeoWithRoute = (routeMeta: RouteMetaWithSeo, t: (key: string) => string) => {
  const seoData = routeMeta.seo;
  if (seoData) {
    updateSeo({
      title: seoData.titleKey ? t(seoData.titleKey) : undefined,
      description: seoData.descriptionKey ? t(seoData.descriptionKey) : undefined,
      keywords: seoData.keywordsKey ? t(seoData.keywordsKey) : undefined,
    });
  } else {
    updateSeo({
      title: t('seo.default.title'),
      description: t('seo.default.description'),
      keywords: t('seo.default.keywords'),
    });
  }
};
