(() => {
  const state = {
    deals: [],
    popular: new Set(),
    updatedAt: null,
    region: localStorage.getItem('sd_region') || 'ru',
    sort: 'discount',
    minDiscount: 50,
    query: '',
    onlyPriced: false,
    onlyPopular: true
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    grid: $('grid'),
    topRow: $('topRow'),
    status: $('status'),
    updated: $('updated'),
    count: $('count'),
    search: $('search'),
    region: $('region'),
    sort: $('sort'),
    minDiscount: $('minDiscount'),
    onlyPriced: $('onlyPriced'),
    onlyPopular: $('onlyPopular'),
    chips: $('chips')
  };

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  els.region.value = state.region;
  els.minDiscount.value = String(state.minDiscount);
  if (els.onlyPopular) els.onlyPopular.checked = state.onlyPopular;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function setStatus(msg, err = false) {
    els.status.hidden = !msg;
    els.status.textContent = msg || '';
    els.status.classList.toggle('err', !!err);
  }

  function formatUpdated(iso) {
    if (!iso) return 'нет данных';
    try {
      const d = new Date(iso);
      return 'обн. ' + d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function bestImage(deal) {
    if (deal.header_image && !/capsule_231/.test(deal.header_image)) return deal.header_image;
    if (deal.capsule && !/capsule_231/.test(deal.capsule)) return deal.capsule;
    if (deal.appid) {
      return 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + deal.appid + '/header.jpg';
    }
    return deal.header_image || deal.capsule || '';
  }

  function trailerUrls(appid) {
    const base = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appid + '/';
    return [base + 'movie_max.webm', base + 'movie480.webm', base + 'movie_max.mp4'];
  }

  function priceFor(deal, region) {
    const p = deal.prices && deal.prices[region];
    if (p && (p.final_formatted || p.final != null)) return p;
    for (const r of ['ru', 'us', 'kz', 'ua']) {
      const x = deal.prices && deal.prices[r];
      if (x && (x.final_formatted || x.final != null)) return { ...x, _fb: r };
    }
    return null;
  }

  function multiLine(deal, region) {
    const parts = [];
    for (const r of ['ru', 'kz', 'ua', 'us']) {
      if (r === region) continue;
      const p = deal.prices && deal.prices[r];
      if (p && p.final_formatted) parts.push(r.toUpperCase() + ' ' + p.final_formatted);
    }
    return parts.slice(0, 3).join(' · ');
  }

  function isPopular(deal) {
    if (state.popular.size === 0) return true;
    return state.popular.has(Number(deal.appid));
  }

  function list() {
    const q = state.query.trim().toLowerCase();
    let arr = state.deals.filter((d) => (d.discount || 0) >= state.minDiscount);
    if (state.onlyPopular) arr = arr.filter(isPopular);
    if (q) arr = arr.filter((d) => (d.name || '').toLowerCase().includes(q));
    if (state.onlyPriced) {
      arr = arr.filter((d) => {
        const p = d.prices && d.prices[state.region];
        return p && (p.final_formatted || p.final != null);
      });
    }
    arr = [...arr];
    if (state.sort === 'discount') {
      arr.sort((a, b) => b.discount - a.discount || String(a.name).localeCompare(String(b.name), 'ru'));
    } else if (state.sort === 'name') {
      arr.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
    } else {
      arr.sort((a, b) => {
        const pa = priceFor(a, state.region);
        const pb = priceFor(b, state.region);
        const va = pa && pa.final != null ? pa.final : Infinity;
        const vb = pb && pb.final != null ? pb.final : Infinity;
        return va - vb;
      });
    }
    return arr;
  }

  function cardHtml(d, compact) {
    const price = priceFor(d, state.region);
    const img = bestImage(d);
    const multi = multiLine(d, state.region);
    let priceHtml;
    if (price && price.final_formatted) {
      priceHtml =
        '<span class="price-now">' + esc(price.final_formatted) + '</span>' +
        (price.original_formatted ? '<span class="price-old">' + esc(price.original_formatted) + '</span>' : '') +
        (price._fb ? '<span class="price-note">(' + esc(price._fb.toUpperCase()) + ')</span>' : '');
    } else {
      priceHtml = '<span class="price-miss">нет цены в ' + esc(state.region.toUpperCase()) + '</span>';
    }

    const fallback =
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + d.appid + '/header.jpg';
    const media =
      '<div class="card-media">' +
      (img
        ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\'" />'
        : '') +
      (canHover
        ? '<video muted loop playsinline preload="none" data-appid="' + d.appid + '"></video>'
        : '') +
      '<span class="badge">−' + d.discount + '%</span></div>';

    return (
      '<a class="card" href="' + esc(d.url) + '" target="_blank" rel="noopener" data-appid="' + d.appid + '">' +
      media +
      '<div class="card-body"><h2 class="card-title">' + esc(d.name || 'Без названия') + '</h2>' +
      '<div class="price-row">' + priceHtml + '</div>' +
      (!compact && multi ? '<div class="multi">' + esc(multi) + '</div>' : '') +
      '</div></a>'
    );
  }

  function bindTrailers(root) {
    if (!canHover || !root) return;
    root.querySelectorAll('.card').forEach((card) => {
      const video = card.querySelector('video');
      if (!video) return;
      let loaded = false;

      card.addEventListener('mouseenter', () => {
        if (!loaded) {
          loaded = true;
          const appid = video.dataset.appid;
          const urls = trailerUrls(appid);
          let i = 0;
          const tryNext = () => {
            if (i >= urls.length) return;
            video.src = urls[i++];
            video.load();
          };
          video.addEventListener('error', tryNext);
          video.addEventListener('loadeddata', () => {
            video.play().catch(() => {});
          }, { once: true });
          tryNext();
        } else {
          video.play().catch(() => {});
        }
        card.classList.add('is-playing');
      });

      card.addEventListener('mouseleave', () => {
        card.classList.remove('is-playing');
        try {
          video.pause();
          video.currentTime = 0;
        } catch (_) {}
      });
    });
  }

  function render() {
    const items = list();
    els.count.textContent = items.length + ' / ' + state.deals.length;
    els.updated.textContent = formatUpdated(state.updatedAt);

    let topPool = state.deals.filter((d) => (d.discount || 0) >= 40);
    if (state.popular.size) {
      const pop = topPool.filter(isPopular);
      if (pop.length >= 3) topPool = pop;
    }
    topPool = [...topPool].sort((a, b) => b.discount - a.discount).slice(0, 4);
    if (els.topRow) {
      els.topRow.innerHTML = topPool.map((d) => cardHtml(d, true)).join('');
      bindTrailers(els.topRow);
    }

    if (!items.length) {
      els.grid.innerHTML = '';
      setStatus(
        state.onlyPopular
          ? 'Среди популярных ничего нет — сними «Только популярные» или уменьши %.'
          : 'Ничего не найдено — ослабь фильтры.'
      );
      return;
    }
    setStatus('');
    els.grid.innerHTML = items.map((d) => cardHtml(d, false)).join('');
    bindTrailers(els.grid);
  }

  function syncChips() {
    els.chips.querySelectorAll('.chip').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.min) === state.minDiscount);
    });
  }

  async function load() {
    setStatus('Загрузка…');
    try {
      const [dealsRes, popRes] = await Promise.all([
        fetch('data/deals.json?t=' + Date.now(), { cache: 'no-store' }),
        fetch('data/popular.json?t=' + Date.now(), { cache: 'no-store' }).catch(() => null)
      ]);
      if (!dealsRes.ok) throw new Error('HTTP ' + dealsRes.status);
      const data = await dealsRes.json();
      state.deals = Array.isArray(data.deals) ? data.deals : [];
      state.updatedAt = data.updated_at || null;

      if (popRes && popRes.ok) {
        const pop = await popRes.json();
        const ids = pop.appids || pop.ids || [];
        state.popular = new Set(ids.map(Number));
      }
      render();
    } catch (e) {
      console.error(e);
      setStatus('Не удалось загрузить данные. Проверь Pages.', true);
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
    syncChips();
    render();
  });
  els.onlyPriced.addEventListener('change', () => {
    state.onlyPriced = els.onlyPriced.checked;
    render();
  });
  if (els.onlyPopular) {
    els.onlyPopular.addEventListener('change', () => {
      state.onlyPopular = els.onlyPopular.checked;
      render();
    });
  }
  els.chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.minDiscount = Number(btn.dataset.min) || 0;
    els.minDiscount.value = String(state.minDiscount);
    syncChips();
    render();
  });

  syncChips();
  load();
})();
