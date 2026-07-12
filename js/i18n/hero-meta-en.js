/** Per-product hero copy — English trust, concerns, cart payloads */
import { PRODUCT_COPY } from './en.js';

export const HERO_META_BY_SLUG = {
  'acne-facial-cleanser': {
    cartId: 1,
    cartName: PRODUCT_COPY['acne-facial-cleanser'].cartName,
    cartImage: 'images/p1-premium.png',
    concerns: PRODUCT_COPY['acne-facial-cleanser'].concerns,
    trust: PRODUCT_COPY['acne-facial-cleanser'].trust,
  },
  'whitening-cleanser': {
    cartId: 2,
    cartName: PRODUCT_COPY['whitening-cleanser'].cartName,
    cartImage: 'images/p2-premium.png',
    concerns: PRODUCT_COPY['whitening-cleanser'].concerns,
    trust: PRODUCT_COPY['whitening-cleanser'].trust,
  },
  'whitening-cream': {
    cartId: 3,
    cartName: PRODUCT_COPY['whitening-cream'].cartName,
    cartImage: 'images/p3-premium.png',
    concerns: PRODUCT_COPY['whitening-cream'].concerns,
    trust: PRODUCT_COPY['whitening-cream'].trust,
  },
  'hand-body-lotion': {
    cartId: 4,
    cartName: PRODUCT_COPY['hand-body-lotion'].cartName,
    cartImage: 'images/p4-premium.png',
    concerns: PRODUCT_COPY['hand-body-lotion'].concerns,
    trust: PRODUCT_COPY['hand-body-lotion'].trust,
  },
  'post-laser-cream': {
    cartId: 5,
    cartName: PRODUCT_COPY['post-laser-cream'].cartName,
    cartImage: 'images/p5-premium.png',
    concerns: PRODUCT_COPY['post-laser-cream'].concerns,
    trust: PRODUCT_COPY['post-laser-cream'].trust,
  },
  'anti-scar-gel': {
    cartId: 6,
    cartName: PRODUCT_COPY['anti-scar-gel'].cartName,
    cartImage: 'images/p6-premium.png',
    concerns: PRODUCT_COPY['anti-scar-gel'].concerns,
    trust: PRODUCT_COPY['anti-scar-gel'].trust,
  },
};

export function enrichHeroSlideEn(slide) {
  const meta = HERO_META_BY_SLUG[slide.slug] || {};
  return {
    ...slide,
    concerns: meta.concerns || slide.concerns || '',
    trust: meta.trust || slide.trust || [],
    cartId: meta.cartId,
    cartName: meta.cartName || slide.name,
    cartImage: meta.cartImage || slide.img,
  };
}
