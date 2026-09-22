(() => {
  const state = {
    deals: [], popular: new Set(), updatedAt: null,
    region: localStorage.getItem('sd_region') || 'ru',
    sort: localStorage.getItem('sd_sort') || 'discount',
    minDiscount: Number(localStorage.getItem('sd_min') ?? 30),
    maxPrice: Number(localStorage.getItem('sd_max') || 0),
    query: '', onlyPriced: localStorage.getItem('sd_priced') === '1',
    onlyPopular: localStorage.getItem('sd_popular') !== '0',
    onlyFree: localStorage.getItem('sd_free') === '1',
    hideUnknown: localStorage.getItem('sd_hide') === '1',
    pageSize: 36, shown: 36
  };
  const $ = (id) => document.getElementById(id);
  const els = {
    grid: $('grid'), topRow: $('topRow'), freeRow: $('freeRow'), freeBlock: $('freeBlock'),
    status: $('status'), updated: $('updated'), count: $('count'), edition: $('edition'),
    search: $('search'), region: $('region'), sort: $('sort'), minDiscount: $('minDiscount'),
    maxPrice: $('maxPrice'), onlyPriced: $('onlyPriced'), onlyPopular: $('onlyPopular'),
    onlyFree: $('onlyFree'), hideUnknown: $('hideUnknown'), discChips: $('discChips'),
    priceChips: $('priceChips'), moreBtn: $('moreBtn'), reset: $('resetFilters')
  };
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (els.region) els.region.value = state.region;
  if (els.sort) els.sort.value = state.sort;
  if (els.minDiscount) els.minDiscount.value = String(state.minDiscount);
  if (els.maxPrice) els.maxPrice.value = String(state.maxPrice);
  if (els.onlyPopular) els.onlyPopular.checked = state.onlyPopular;
  if (els.onlyPriced) els.onlyPriced.checked = state.onlyPriced;
  if (els.onlyFree) els.onlyFree.checked = state.onlyFree;
  if (els.hideUnknown) els.hideUnknown.checked = state.hideUnknown;

  function esc(s) {
    return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
  }
  function setStatus(msg, err) {
    if (!els.status) return;
    els.status.hidden = !msg;
    els.status.textContent = msg || '';
    els.status.classList.toggle('err', !!err);
  }
  function formatUpdated(iso) {
    if (!iso) return 'дата неизвестна';
    try {
      return new Date(iso).toLocaleString('ru-RU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    } catch { return iso; }
  }
  function bestImage(deal) {
    if (deal.appid) return 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + deal.appid + '/header.jpg';
    return deal.header_image || deal.capsule || '';
  }
  function trailerUrls(appid) {
    const b = 'https://cdn.akamai.steamstatic.com/steam/apps/' + appid + '/';
    return [b + 'movie_max.webm', b + 'movie480.webm', b + 'movie_max.mp4'];
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
  function isPopular(deal) {
    if (state.popular.size === 0) return true;
    return state.popular.has(Number(deal.appid));
  }
  function isFree(deal) {
    if ((deal.discount || 0) >= 100) return true;
    const p = priceFor(deal, state.region);
    return p && (p.final === 0 || /free|бесплат|0[,.]00/i.test(String(p.final_formatted || '')));
  }
  function tileSize(d, index) {
    const disc = d.discount || 0;
    if (disc >= 90 && index < 2) return 'tile-xl';
    if (disc >= 80) return 'tile-lg';
    if (disc >= 50) return 'tile-md';
    return 'tile-sm';
  }
  function list() {
    const q = state.query.trim().toLowerCase();
    let arr = state.deals.filter((d) => (d.discount || 0) >= state.minDiscount);
    if (state.onlyFree) arr = arr.filter(isFree);
    if (state.onlyPopular && state.popular.size) {
      const hard = arr.filter(isPopular);
      if (hard.length < 10 && !state.onlyFree) {
        const extra = arr.filter((d) => !isPopular(d) && (d.discount || 0) >= 70);
        const seen = new Set(hard.map((d) => d.appid));
        for (const d of extra) { if (!seen.has(d.appid)) { hard.push(d); seen.add(d.appid); } }
        arr = hard;
      } else arr = hard;
    }
    if (q) arr = arr.filter((d) => (d.name || '').toLowerCase().includes(q));
    if (state.onlyPriced || state.hideUnknown) {
      arr = arr.filter((d) => {
        const p = d.prices && d.prices[state.region];
        return p && (p.final_formatted || p.final != null);
      });
    }
    if (state.maxPrice > 0) {
      arr = arr.filter((d) => {
        const p = priceFor(d, state.region);
        if (!p || p.final == null) return false;
        const major = p.final / 100;
        const val = major > 0 && major < 500000 ? major : p.final;
        return val <= state.maxPrice;
      });
    }
    arr = [...arr];
    if (state.sort === 'discount') {
      arr.sort((a, b) => (isPopular(b)?1:0)-(isPopular(a)?1:0) || b.discount-a.discount || String(a.name).localeCompare(String(b.name),'ru'));
    } else if (state.sort === 'name') {
      arr.sort((a, b) => String(a.name).localeCompare(String(b.name),'ru'));
    } else if (state.sort === 'savings') {
      arr.sort((a, b) => {
        const pa = priceFor(a, state.region), pb = priceFor(b, state.region);
        const sa = pa && pa.original != null && pa.final != null ? pa.original - pa.final : -1;
        const sb = pb && pb.original != null && pb.final != null ? pb.original - pb.final : -1;
        return sb - sa;
      });
    } else {
      arr.sort((a, b) => {
        const pa = priceFor(a, state.region), pb = priceFor(b, state.region);
        return (pa && pa.final != null ? pa.final : Infinity) - (pb && pb.final != null ? pb.final : Infinity);
      });
    }
    return arr;
  }
  function cardHtml(d, sizeClass, compact) {
    const price = priceFor(d, state.region);
    const img = bestImage(d);
    const multi = multiLine(d, state.region);
    const pop = isPopular(d);
    const hot = (d.discount || 0) >= 80;
    let priceHtml;
    if (price && price.final_formatted) {
      priceHtml = '<span class="p-now">' + esc(price.final_formatted) + '</span>' +
        (price.original_formatted ? '<span class="p-old">' + esc(price.original_formatted) + '</span>' : '') +
        (price._fb ? '<span class="p-note">(' + esc(price._fb.toUpperCase()) + ')</span>' : '');
    } else {
      priceHtml = '<span class="p-miss">цена в Steam</span>';
    }
    const media = '<div class="tile-media">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + d.appid + '/capsule_616x353.jpg\'" />' : '') +
      (canHover ? '<video muted loop playsinline preload="none" data-appid="' + d.appid + '"></video>' : '') +
      '<span class="stamp' + (hot ? ' hot' : '') + '">−' + d.discount + '%</span>' +
      (pop ? '<span class="badge-top">изв.</span>' : '') + '</div>';
    return '<a class="tile ' + sizeClass + '" href="' + esc(d.url || 'https://store.steampowered.com/app/' + d.appid + '/') +
      '" target="_blank" rel="noopener" data-appid="' + d.appid + '">' + media +
      '<div class="tile-body"><h3 class="tile-name">' + esc(d.name || 'Без названия') + '</h3><div class="price-line">' +
      priceHtml + '</div>' + (!compact && multi ? '<div class="multi">' + esc(multi) + '</div>' : '') + '</div></a>';
  }
  function bindTrailers(root) {
    if (!canHover || !root) return;
    root.querySelectorAll('.tile').forEach((card) => {
      const video = card.querySelector('video');
      if (!video || video.dataset.bound) return;
      video.dataset.bound = '1';
      let loaded = false;
      card.addEventListener('mouseenter', () => {
        if (!loaded) {
          loaded = true;
          const urls = trailerUrls(video.dataset.appid);
          let i = 0;
          const tryNext = () => { if (i >= urls.length) return; video.src = urls[i++]; video.load(); };
          video.addEventListener('error', tryNext);
          video.addEventListener('loadeddata', () => { video.play().catch(() => {}); }, { once: true });
          tryNext();
        } else video.play().catch(() => {});
        card.classList.add('playing');
      });
      card.addEventListener('mouseleave', () => {
        card.classList.remove('playing');
        try { video.pause(); video.currentTime = 0; } catch (_) {}
      });
    });
  }
  function renderFree() {
    if (!els.freeRow || !els.freeBlock) return;
    const free = state.deals.filter(isFree).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru')).slice(0,4);
    if (!free.length) { els.freeBlock.hidden = true; return; }
    els.freeBlock.hidden = false;
    els.freeRow.innerHTML = free.map((d,i)=>cardHtml(d, i===0?'tile-lg':'tile-md', true)).join('');
    els.freeRow.querySelectorAll('.tile').forEach((el)=>{ el.style.gridColumn = 'span 1'; });
    bindTrailers(els.freeRow);
  }
  function render() {
    const items = list();
    const total = state.deals.length;
    if (els.count) els.count.textContent = items.length + ' из ' + total;
    if (els.updated) els.updated.textContent = formatUpdated(state.updatedAt);
    if (els.edition) els.edition.textContent = 'вып. · ' + (state.updatedAt ? state.updatedAt.slice(0,10) : 'specials');
    let topPool = state.deals.filter((d)=>(d.discount||0)>=45);
    if (state.popular.size) {
      const pop = topPool.filter(isPopular);
      if (pop.length >= 3) topPool = pop;
    }
    topPool = [...topPool].sort((a,b)=>b.discount-a.discount).slice(0,4);
    if (els.topRow) {
      els.topRow.innerHTML = topPool.map((d,i)=>cardHtml(d, i===0?'tile-xl':i===1?'tile-lg':'tile-md', true)).join('');
      els.topRow.querySelectorAll('.tile').forEach((el)=>{ el.style.gridColumn = 'span 1'; });
      bindTrailers(els.topRow);
    }
    renderFree();
    if (!items.length) {
      if (els.grid) els.grid.innerHTML = '';
      if (els.moreBtn) els.moreBtn.hidden = true;
      setStatus('Пусто. Сними фильтры или сбрось всё.');
      return;
    }
    setStatus('');
    const slice = items.slice(0, state.shown);
    if (els.grid) els.grid.innerHTML = slice.map((d,i)=>cardHtml(d, tileSize(d,i), false)).join('');
    bindTrailers(els.grid);
    if (els.moreBtn) {
      const left = items.length - slice.length;
      els.moreBtn.hidden = left <= 0;
      els.moreBtn.textContent = left > 0 ? 'ещё ' + left + ' из архива' : 'всё';
    }
  }
  function syncChips() {
    if (els.discChips) els.discChips.querySelectorAll('.chip').forEach((btn)=>{
      btn.classList.toggle('on', Number(btn.dataset.min) === state.minDiscount);
    });
    if (els.priceChips) els.priceChips.querySelectorAll('.chip').forEach((btn)=>{
      btn.classList.toggle('on', Number(btn.dataset.max) === state.maxPrice);
    });
  }
  function persist() {
    localStorage.setItem('sd_region', state.region);
    localStorage.setItem('sd_sort', state.sort);
    localStorage.setItem('sd_min', String(state.minDiscount));
    localStorage.setItem('sd_max', String(state.maxPrice));
    localStorage.setItem('sd_priced', state.onlyPriced ? '1' : '0');
    localStorage.setItem('sd_popular', state.onlyPopular ? '1' : '0');
    localStorage.setItem('sd_free', state.onlyFree ? '1' : '0');
    localStorage.setItem('sd_hide', state.hideUnknown ? '1' : '0');
  }
  function resetAll() {
    state.query = ''; state.minDiscount = 30; state.maxPrice = 0; state.sort = 'discount';
    state.onlyPopular = true; state.onlyPriced = false; state.onlyFree = false; state.hideUnknown = false;
    state.shown = state.pageSize;
    if (els.search) els.search.value = '';
    if (els.minDiscount) els.minDiscount.value = '30';
    if (els.maxPrice) els.maxPrice.value = '0';
    if (els.sort) els.sort.value = 'discount';
    if (els.onlyPopular) els.onlyPopular.checked = true;
    if (els.onlyPriced) els.onlyPriced.checked = false;
    if (els.onlyFree) els.onlyFree.checked = false;
    if (els.hideUnknown) els.hideUnknown.checked = false;
    persist(); syncChips(); render();
  }
  async function load() {
    setStatus('набор номера…');
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
        state.popular = new Set((pop.appids || pop.ids || []).map(Number));
      }
      state.shown = state.pageSize;
      setStatus('');
      render();
    } catch (e) {
      console.error(e);
      setStatus('Не загрузилось. Проверь Pages / Actions.', true);
    }
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  on(els.search, 'input', () => { state.query = els.search.value; state.shown = state.pageSize; render(); });
  on(els.region, 'change', () => { state.region = els.region.value; persist(); render(); });
  on(els.sort, 'change', () => { state.sort = els.sort.value; persist(); render(); });
  on(els.minDiscount, 'change', () => { state.minDiscount = Number(els.minDiscount.value)||0; state.shown = state.pageSize; persist(); syncChips(); render(); });
  on(els.maxPrice, 'change', () => { state.maxPrice = Number(els.maxPrice.value)||0; state.shown = state.pageSize; persist(); syncChips(); render(); });
  on(els.onlyPriced, 'change', () => { state.onlyPriced = els.onlyPriced.checked; persist(); render(); });
  on(els.onlyPopular, 'change', () => { state.onlyPopular = els.onlyPopular.checked; state.shown = state.pageSize; persist(); render(); });
  on(els.onlyFree, 'change', () => { state.onlyFree = els.onlyFree.checked; state.shown = state.pageSize; persist(); render(); });
  on(els.hideUnknown, 'change', () => { state.hideUnknown = els.hideUnknown.checked; persist(); render(); });
  on(els.discChips, 'click', (e) => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    state.minDiscount = Number(btn.dataset.min)||0; els.minDiscount.value = String(state.minDiscount);
    state.shown = state.pageSize; persist(); syncChips(); render();
  });
  on(els.priceChips, 'click', (e) => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    state.maxPrice = Number(btn.dataset.max)||0; els.maxPrice.value = String(state.maxPrice);
    state.shown = state.pageSize; persist(); syncChips(); render();
  });
  on(els.moreBtn, 'click', () => { state.shown += state.pageSize; render(); });
  on(els.reset, 'click', resetAll);
  syncChips();
  load();
})();
