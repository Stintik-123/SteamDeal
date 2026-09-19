(() => {
  const state = {
    deals: [],
    updatedAt: null,
    region: localStorage.getItem('sd_region') || 'ru',
    sort: 'discount',
    minDiscount: 50,
    query: ''
  };

  const els = {
    grid: document.getElementById('grid'),
    status: document.getElementById('status'),
    updated: document.getElementById('updated'),
    count: document.getElementById('count'),
    search: document.getElementById('search'),
    region: document.getElementById('region'),
    sort: document.getElementById('sort'),
    minDiscount: document.getElementById('minDiscount')
  };

  els.region.value = state.region;
  els.minDiscount.value = String(state.minDiscount);

  function showStatus(msg, isError = false) {
    els.status.hidden = !msg;
    els.status.textContent = msg || '';
    els.status.classList.toggle('error', !!isError);
  }

  function formatUpdated(iso) {
    if (!iso) return 'нет данных';
    try {
      const d = new Date(iso);
      return 'обновлено ' + d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function priceFor(deal, region) {
    const p = deal.prices && deal.prices[region];
    if (p && p.final_formatted) return p;
    for (const r of ['ru', 'us', 'kz', 'ua']) {
      const x = deal.prices && deal.prices[r];
      if (x && x.final_formatted) return { ...x, _fallback: r };
    }
    return null;
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = state.deals.filter((d) => d.discount >= state.minDiscount);
    if (q) list = list.filter((d) => (d.name || '').toLowerCase().includes(q));

    list = [...list];
    if (state.sort === 'discount') {
      list.sort((a, b) => b.discount - a.discount || (a.name || '').localeCompare(b.name || ''));
    } else if (state.sort === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
    } else if (state.sort === 'price') {
      list.sort((a, b) => {
        const pa = priceFor(a, state.region);
        const pb = priceFor(b, state.region);
        const va = pa && pa.final != null ? pa.final : Infinity;
        const vb = pb && pb.final != null ? pb.final : Infinity;
        return va - vb;
      });
    }
    return list;
  }

  function render() {
    const list = filtered();
    els.count.textContent = `${list.length} игр`;
    els.updated.textContent = formatUpdated(state.updatedAt);

    if (!list.length) {
      els.grid.innerHTML = '';
      showStatus('Ничего не найдено. Сними фильтр или измени поиск.');
      return;
    }
    showStatus('');

    els.grid.innerHTML = list.map((d) => {
      const price = priceFor(d, state.region);
      const img = d.capsule || d.header_image || '';
      const priceHtml = price
        ? `<span class="price-now">${escapeHtml(price.final_formatted)}</span>
           ${price.original_formatted ? `<span class="price-old">${escapeHtml(price.original_formatted)}</span>` : ''}
           ${price._fallback ? `<span class="regions-mini">(${price._fallback.toUpperCase()})</span>` : ''}`
        : `<span class="price-missing">цена недоступна в регионе</span>`;

      return `
        <a class="card" href="${escapeAttr(d.url)}" target="_blank" rel="noopener">
          <div class="card-img">
            ${img ? `<img src="${escapeAttr(img)}" alt="" loading="lazy" />` : ''}
            <span class="badge">−${d.discount}%</span>
          </div>
          <div class="card-body">
            <h2 class="card-title">${escapeHtml(d.name || 'Без названия')}</h2>
            <div class="prices">${priceHtml}</div>
          </div>
        </a>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  async function load() {
    showStatus('Загрузка скидок…');
    try {
      const res = await fetch(`data/deals.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.deals = Array.isArray(data.deals) ? data.deals : [];
      state.updatedAt = data.updated_at || null;
      render();
    } catch (e) {
      console.error(e);
      showStatus('Не удалось загрузить data/deals.json. Проверь GitHub Pages и Actions.', true);
    }
  }

  els.search.addEventListener('input', () => {
    state.query = els.search.value;
    render();
  });
  els.region.addEventListener('change', () => {
    state.region = els.region.value;
    localStorage.setItem('sd_region', state.region);
    render();
  });
  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    render();
  });
  els.minDiscount.addEventListener('change', () => {
    state.minDiscount = Number(els.minDiscount.value) || 0;
    render();
  });

  load();
})();
