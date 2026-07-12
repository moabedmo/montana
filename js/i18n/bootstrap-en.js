/** Sets window.MONTANA_UI for legacy scripts on English pages */
import { UI_STRINGS, CONCERNS, HOME_SECTIONS, COSMETIC_DISCLAIMER, PRODUCT_COPY } from './en.js';
import { resolveAssetUrl } from './locale.js';

window.MONTANA_LOCALE = 'en';
window.MONTANA_UI = UI_STRINGS;
window.MONTANA_CONCERNS = CONCERNS;
window.MONTANA_HOME = HOME_SECTIONS;
window.MONTANA_DISCLAIMER = COSMETIC_DISCLAIMER;
window.MONTANA_PRODUCT_COPY = PRODUCT_COPY;
window.MONTANA_resolveAssetUrl = resolveAssetUrl;
