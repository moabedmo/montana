// Montana wishlist — persisted in localStorage (works for guests + logged-in users).
(function () {
  const KEY = 'montana_wishlist';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function write(ids) {
    localStorage.setItem(KEY, JSON.stringify(ids));
    updateBadges();
    window.renderAppFavorites?.();
  }

  function updateBadges() {
    const n = window.Wishlist.getCount();
    document.querySelectorAll('.wishlist-badge, .nav-badge-wishlist').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? '' : 'none';
    });
    document.querySelectorAll('.wishlist-btn, .cat-wishlist').forEach(btn => {
      const id = parseInt(btn.dataset.productId, 10);
      if (!id) return;
      const on = window.Wishlist.has(id);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = on ? 'fas fa-heart' : 'far fa-heart';
        btn.style.color = on ? '#e74c3c' : '';
      }
    });
  }

  window.renderAppFavorites = async function () {
    const body = document.querySelector('#screen-favorites .app-screen-body');
    if (!body || !window.Wishlist) return;
    const ids = window.Wishlist.getIds();
    if (!ids.length) {
      body.innerHTML = `<div class="app-empty-state">
        <div class="app-empty-icon"><i class="far fa-heart"></i></div>
        <h3>قائمة المفضلة فارغة</h3>
        <p>اضغط على ♡ في أي منتج لإضافته هنا</p>
        <button class="app-empty-btn" onclick="window.location.href='category.html'">تصفح المنتجات</button>
      </div>`;
      return;
    }
    try {
      const { products: productsApi } = await import('/js/store-api.js');
      const { localizeProduct, formatPrice, getLocale, resolveAssetUrl, productUrl } = await import('/js/i18n/locale.js?v=3');
      const all = await productsApi.list();
      const list = all.filter(p => ids.includes(p.id)).map((p) => localizeProduct(p) || p);
      if (!list.length) {
        body.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد منتجات متاحة</p>';
        return;
      }
      const isEn = getLocale() === 'en';
      const priceFmt = (n) => (isEn ? `${Math.round(n).toLocaleString('en-EG')} EGP` : `${Math.round(n)} ج.م`);
      body.innerHTML = list.map(p => `
        <a href="${productUrl(p.slug)}" class="app-offer-card" style="text-decoration:none;color:inherit;margin-bottom:12px;display:flex;gap:12px;padding:12px;background:var(--bg-light,rgba(255,255,255,.05));border-radius:14px">
          <img src="${resolveAssetUrl(p.image_url)}" alt="${p.name.replace(/"/g, '&quot;')}" style="width:72px;height:72px;object-fit:contain;border-radius:10px">
          <div><span class="app-offer-brand">Montaña</span><h4 style="font-size:14px;margin:4px 0">${p.name}</h4>
          <span class="app-price-new">${priceFmt(p.price)}</span></div>
        </a>`).join('');
    } catch {
      body.innerHTML = `<a href="wishlist.html" class="app-empty-btn" style="display:block;text-align:center;margin:20px">عرض المفضلة</a>`;
    }
  };

  window.Wishlist = {
    getIds() { return read(); },
    getCount() { return read().length; },
    has(productId) { return read().includes(Number(productId)); },
    toggle(productId) {
      productId = Number(productId);
      let ids = read();
      if (ids.includes(productId)) ids = ids.filter(i => i !== productId);
      else ids.push(productId);
      write(ids);
      return ids.includes(productId);
    },
    remove(productId) {
      write(read().filter(i => i !== Number(productId)));
    },
    refreshUI: updateBadges
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateBadges();
    window.renderAppFavorites?.();
  });
  if (document.readyState !== 'loading') {
    updateBadges();
    window.renderAppFavorites?.();
  }
})();
