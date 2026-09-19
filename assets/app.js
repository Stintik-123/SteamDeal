(() => {
  const state = {
    deals: [],
    updatedAt: null,
    region: localStorage.getItem('sd_region') || 'ru',
    sort: 'discount',
    minDiscount: 50,
    query: '',
    onlyPriced: false
  };
  const $ = (id) => document.getElementById(id);
  const els = {
    grid: $('grid'), status: $('status'), updated: $('updated'), count: $('count'),
    search: $('search'), region: $('region'), sort: $('sort'),
    minDiscount: $('minDiscount'), onlyPriced: $('onlyPriced'), chips: $('chips')
  };
  els.region.value = state.region;
  els.minDiscount.value = String(state.minDiscount);
  function esc(s) {
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
  }
  function setStatus(msg, err=false) {
    els.status.hidden = !msg;
    els.status.textContent = msg || '';
    els.status.classList.toggle('err', !!err);
  }
  function formatUpdated(iso) {
    if (!iso) return 'нет данных';
    try {
      const d = new Date(iso);
      return 'обн. ' + d.toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    } catch { return iso; }
  }
  function priceFor(deal, region) {
    const p = deal.prices && deal.prices[region];
    if (p && (p.final_formatted || p.final != null)) return p;
    for (const r of ['ru','us','kz','ua']) {
      const x = deal.prices && deal.prices[r];
      if (x && (x.final_formatted || x.final != null)) return { ...x, _fb: r };
    }
    return null;
  }
  function multiLine(deal, region) {
    const parts = [];
    for (const r of ['ru','kz','ua','us']) {
      if (r === region) continue;
      const p = deal.prices && deal.prices[r];
      if (p && p.final_formatted) parts.push(r.toUpperCase() + ' ' + p.final_formatted);
    }
    return parts.slice(0, 3).join(' · ');
  }
  function list() {
    const q = state.query.trim().toLowerCase();
    let arr = state.deals.filter(d => (d.discount || 0) >= state.minDiscount);
    if (q) arr = arr.filter(d => (d.name || '').toLowerCase().includes(q));
    if (state.onlyPriced) {
      arr = arr.filter(d => {
        const p = d.prices && d.prices[state.region];
        return p && (p.final_formatted || p.final != null);
      });
    }
    arr = [...arr];
    if (state.sort === 'discount') arr.sort((a,b) => (b.discount - a.discount) || String(a.name).localeCompare(String(b.name), 'ru'));
    else if (state.sort === 'name') arr.sort((a,b) => String(a.name).localeCompare(String(b.name), 'ru'));
    else arr.sort((a,b) => {
      const pa = priceFor(a, state.region), pb = priceFor(b, state.region);
      const va = pa && pa.final != null ? pa.final : Infinity;
      const vb = pb && pb.final != null ? pb.final : Infinity;
      return va - vb;
    });
    return arr;
  }
  function render() {
    const items = list();
    els.count.textContent = items.length + ' / ' + state.deals.length;
    els.updated.textContent = formatUpdated(state.updatedAt);
    if (!items.length) {
      els.grid.innerHTML = '';
      setStatus('Ничего не найдено — ослабь фильтры или смени регион.');
      return;
    }
    setStatus('');
    els.grid.innerHTML = items.map(d => {
      const price = priceFor(d, state.region);
      const img = d.capsule || d.header_image || '';
      const multi = multiLine(d, state.region);
      let priceHtml;
      if (price && price.final_formatted) {
        priceHtml = '<span class="price-now">' + esc(price.final_formatted) + '</span>'
          + (price.original_formatted ? '<span class="price-old">' + esc(price.original_formatted) + '</span>' : '')
          + (price._fb ? '<span class="price-note">(' + esc(price._fb.toUpperCase()) + ')</span>' : '');
      } else {
        priceHtml = '<span class="price-miss">нет цены в ' + esc(state.region.toUpperCase()) + '</span>';
      }
      return '<a class="card" href="' + esc(d.url) + '" target="_blank" rel="noopener">'
        + '<div class="card-media">'
        + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" />' : '')
        + '<span class="badge">−' + d.discount + '%</span></div>'
        + '<div class="card-body"><h2 class="card-title">' + esc(d.name || 'Без названия') + '</h2>'
        + '<div class="price-row">' + priceHtml + '</div>'
        + (multi ? '<div class="multi">' + esc(multi) + '</div>' : '')
        + '</div></a>';
    }).join('');
  }
  function syncChips() {
    els.chips.querySelectorAll('.chip').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.min) === state.minDiscount);
    });
  }
  async function load() {
    setStatus('Загрузка…');
    try {
      const res = await fetch('data/deals.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.deals = Array.isArray(data.deals) ? data.deals : [];
      state.updatedAt = data.updated_at || null;
      render();
    } catch (e) {
      console.error(e);
      setStatus('Не удалось загрузить data/deals.json. Включи Pages и Actions.', true);
    }
  }
  els.search.addEventListener('input', () => { state.query = els.search.value; render(); });
  els.region.addEventListener('change', () => {
    state.region = els.region.value;
    localStorage.setItem('sd_region', state.region);
    render();
  });
  els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });
  els.minDiscount.addEventListener('change', () => {
    state.minDiscount = Number(els.minDiscount.value) || 0;
    syncChips(); render();
  });
  els.onlyPriced.addEventListener('change', () => {
    state.onlyPriced = els.onlyPriced.checked; render();
  });
  els.chips.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.minDiscount = Number(btn.dataset.min) || 0;
    els.minDiscount.value = String(state.minDiscount);
    syncChips(); render();
  });
  syncChips();
  load();
})();
