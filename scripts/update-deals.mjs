import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'deals.json');
const REGIONS = ['ru', 'us', 'kz', 'ua'];
const UA = 'Mozilla/5.0 (compatible; SteamDeal/2.0; +https://github.com/Stintik-123/SteamDeal)';
const MAX_SEARCH = Number(process.env.MAX_DEALS || 300);
const ENRICH_TOP = Number(process.env.ENRICH_TOP || 80);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.json();
}

function fmtPrice(cents, currency) {
  if (cents == null) return null;
  const major = cents / 100;
  const symbols = { RUB: '₽', USD: '$', KZT: '₸', UAH: '₴', EUR: '€' };
  const sym = symbols[currency] || currency + ' ';
  if (currency === 'USD') return '$' + major.toFixed(2);
  if (Number.isInteger(major)) return major + ' ' + sym.trim();
  return major.toFixed(2) + ' ' + sym.trim();
}

function parseSearchHtml(html) {
  const deals = [];
  const parts = html.split(/(?=<a href="https:\/\/store\.steampowered\.com\/(?:app|bundle|sub)\/)/);
  for (const part of parts.slice(1)) {
    const mApp = part.match(/data-ds-appid="(\d+)"/);
    if (!mApp) continue;
    const appid = Number(mApp[1]);
    const mName = part.match(/class="title"[^>]*>\s*([^<]+)/);
    let name = mName ? mName[1].trim() : 'App ' + appid;
    name = name.replace(/\s+/g, ' ');
    const mDisc = part.match(/discount_pct[^>]*>\s*-?\s*(\d+)/);
    const discount = mDisc ? Number(mDisc[1]) : 0;
    const finals = [...part.matchAll(/data-price-final="(\d+)"/g)].map((m) => Number(m[1]));
    const final = finals[0] ?? null;
    const mImg = part.match(/<img[^>]+src="([^"]+)"/);
    const img = mImg ? mImg[1] : null;
    if (discount <= 0) continue;
    deals.push({ appid, name, discount, final_cents: final, img });
  }
  return deals;
}

async function searchSpecials(cc, maxItems) {
  const out = [];
  let start = 0;
  const count = 100;
  while (start < maxItems) {
    const url = 'https://store.steampowered.com/search/results/?query=&start=' + start + '&count=' + count + '&specials=1&infinite=1&cc=' + cc + '&l=english';
    const data = await fetchJson(url);
    const batch = parseSearchHtml(data.results_html || '');
    console.log('search', cc, 'start', start, 'got', batch.length);
    if (!batch.length) break;
    out.push(...batch);
    start += count;
    if (start >= Number(data.total_count || 0)) break;
    await sleep(400);
  }
  const by = new Map();
  for (const d of out) {
    const prev = by.get(d.appid);
    if (!prev || d.discount > prev.discount) by.set(d.appid, d);
  }
  return [...by.values()];
}

async function featuredPrices() {
  const map = new Map();
  for (const cc of REGIONS) {
    try {
      const data = await fetchJson('https://store.steampowered.com/api/featuredcategories/?cc=' + cc + '&l=english');
      for (const item of data?.specials?.items || []) {
        const aid = Number(item.id);
        if (!aid) continue;
        if (!map.has(aid)) map.set(aid, {});
        const cur = item.currency || cc.toUpperCase();
        map.get(aid)[cc] = {
          currency: cur,
          final: item.final_price ?? null,
          original: item.original_price ?? null,
          final_formatted: fmtPrice(item.final_price, cur),
          original_formatted: fmtPrice(item.original_price, cur),
          discount: item.discount_percent
        };
      }
    } catch (e) {
      console.warn('featured', cc, e.message);
    }
    await sleep(250);
  }
  return map;
}

async function appDetailsPrices(appid) {
  const prices = {};
  let meta = {};
  for (const cc of REGIONS) {
    try {
      const data = await fetchJson('https://store.steampowered.com/api/appdetails?appids=' + appid + '&cc=' + cc + '&filters=price_overview');
      const entry = data?.[String(appid)];
      if (!entry?.success) continue;
      const d = entry.data || {};
      if (!meta.name && d.name) meta.name = d.name;
      if (!meta.header && d.header_image) meta.header = d.header_image;
      const po = d.price_overview;
      if (po) {
        prices[cc] = {
          currency: po.currency,
          final: po.final,
          original: po.initial,
          final_formatted: po.final_formatted || fmtPrice(po.final, po.currency),
          original_formatted: po.initial_formatted || fmtPrice(po.initial, po.currency),
          discount: po.discount_percent
        };
      }
    } catch {}
    await sleep(200);
  }
  return { meta, prices };
}

async function main() {
  console.log('Fetching specials…');
  const list = await searchSpecials('ru', MAX_SEARCH);
  list.sort((a, b) => b.discount - a.discount);
  console.log('unique', list.length);
  const feat = await featuredPrices();
  const deals = [];
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const prices = { ...(feat.get(d.appid) || {}) };
    if (d.final_cents != null && !prices.ru) {
      const disc = d.discount || 0;
      const final = d.final_cents;
      const original = disc > 0 && disc < 100 ? Math.round(final / (1 - disc / 100)) : final;
      prices.ru = {
        currency: 'RUB', final, original,
        final_formatted: fmtPrice(final, 'RUB'),
        original_formatted: fmtPrice(original, 'RUB')
      };
    }
    if (i < ENRICH_TOP && Object.keys(prices).length < 2) {
      const { meta, prices: p2 } = await appDetailsPrices(d.appid);
      Object.assign(prices, p2);
      if (meta.name) d.name = meta.name;
      if (meta.header) d.img = meta.header;
      for (const cc of REGIONS) {
        if (prices[cc]?.discount) d.discount = Math.max(d.discount, Number(prices[cc].discount));
      }
    }
    deals.push({
      appid: d.appid,
      name: d.name,
      discount: d.discount,
      header_image: d.img || null,
      capsule: d.img || null,
      url: 'https://store.steampowered.com/app/' + d.appid + '/',
      discount_expiration: null,
      prices
    });
  }
  const out = {
    updated_at: new Date().toISOString(),
    source: 'steam_search_specials+featuredcategories+appdetails',
    regions: REGIONS,
    count: deals.length,
    deals
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('Wrote', deals.length, 'deals');
}

main().catch((e) => { console.error(e); process.exit(1); });
