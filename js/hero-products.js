// Hero carousel assets — splash PNGs (p1–p5), not the cut-out real-hero files.
import { enrichHeroSlide } from './hero-meta.js';
import { enrichHeroSlideEn } from './i18n/hero-meta-en.js';
import { localizeProduct, getLocale, resolveAssetUrl } from './i18n/locale.js?v=3';
import { HERO_SLIDES } from './i18n/en.js';

export const HERO_MOODS = ['#453f64', '#4f3f5c', '#543d67', '#503f60', '#5a4358', '#493d58'];

export const HERO_IMG_BY_SLUG = {
  'acne-facial-cleanser': 'images/p1.png',
  'whitening-cleanser': 'images/p2.png',
  'whitening-cream': 'images/p3.png',
  'hand-body-lotion': 'images/p4.png',
  'post-laser-cream': 'images/p5.png',
  'anti-scar-gel': 'images/p6.png',
};

/** Only the tall pump bottles (both cleansers) — jars/tubes stay at 1. */
export const HERO_SCALE_BY_SLUG = {
  'acne-facial-cleanser': 1.16,
  'whitening-cleanser': 1.16,
};

const HERO_VER = '14';

export function heroImageForProduct(p) {
  const base = HERO_IMG_BY_SLUG[p.slug] || p.image_url || 'images/p1.png';
  const sep = base.includes('?') ? '&' : '?';
  return resolveAssetUrl(`${base}${sep}v=${HERO_VER}`);
}

export function heroScaleForProduct(p) {
  return HERO_SCALE_BY_SLUG[p.slug] ?? 1;
}

export function mapProductToHeroSlide(p, i) {
  const lp = localizeProduct(p) || p;
  const slide = {
    img: heroImageForProduct(lp),
    en: (lp.name_en || lp.name || lp.slug || '').toUpperCase().replace(/-/g, ' '),
    name: lp.name,
    tag: (lp.tagline || (lp.description || '').split('\n')[0] || lp.name).slice(0, 80),
    price: Math.round(lp.price),
    mood: HERO_MOODS[i % HERO_MOODS.length],
    scale: heroScaleForProduct(lp),
    slug: lp.slug,
  };
  if (getLocale() === 'en') {
    const fromCatalog = HERO_SLIDES.find((s) => s.slug === lp.slug);
    if (fromCatalog) {
      slide.en = fromCatalog.en;
      slide.name = fromCatalog.name;
      slide.tag = fromCatalog.tag;
      slide.mood = fromCatalog.mood ?? slide.mood;
      slide.scale = fromCatalog.scale ?? slide.scale;
    }
    return enrichHeroSlideEn(slide);
  }
  return enrichHeroSlide(slide);
}
