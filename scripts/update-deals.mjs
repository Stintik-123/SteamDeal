import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'deals.json');

const REGIONS = ['ru', 'us', 'kz', 'ua'];
const UA = 'SteamDeal/1.1 (github.com/Stintik-123/SteamDeal)';

function fmtPrice(cents, currency) {
  if (cents == null) return null;
  const major = cents / 100;
  const symbols = { RUB: '₽', USD: '$', KZT: '₸', UAH: '₴', EUR: '€' };
  const sym = symbols[currency] || `${currency} `;
  if (currency === 'USD') return `$${major.toFixed(2)}`;
  if (Number.isInteger(major)) return `${major} ${sym}`.trim();
  return `${major.toFixed(2)} ${sym}`.trim();
}

async function fetchRegion(cc) {
  const url = `https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Steam ${cc}: ${res.status}`);
  return res.json();
}

async function main() {
  const byId = new Map();

  for (const cc of REGIONS) {
    const data = await fetchRegion(cc);
    const items = data?.specials?.items || [];
    for (const item of items) {
      const aid = Number(item.id);
      if (!aid) continue;
      if (!byId.has(aid)) {
        byId.set(aid, {
          appid: aid,
          name: item.name,
          discount: Number(item.discount_percent || 0),
          header_image: item.header_image || null,
          capsule: item.large_capsule_image || item.small_capsule_image || null,
          url: `https://store.steampowered.com/app/${aid}/`,
          discount_expiration: item.discount_expiration || null,
          prices: {}
        });
      }
      const row = byId.get(aid);
      const cur = item.currency || cc.toUpperCase();
      row.prices[cc] = {
        currency: cur,
        final: item.final_price ?? null,
        original: item.original_price ?? null,
        final_formatted: fmtPrice(item.final_price, cur),
        original_formatted: fmtPrice(item.original_price, cur)
      };
      if (item.name) row.name = item.name;
      row.discount = Math.max(row.discount, Number(item.discount_percent || 0));
      if (item.header_image) row.header_image = item.header_image;
      if (item.large_capsule_image) row.capsule = item.large_capsule_image;
    }
  }

  const deals = [...byId.values()]
    .filter((d) => d.discount > 0)
    .sort((a, b) => b.discount - a.discount || String(a.name).localeCompare(String(b.name)));

  const out = {
    updated_at: new Date().toISOString(),
    source: 'steam_featuredcategories',
    regions: REGIONS,
    count: deals.length,
    deals
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${deals.length} deals → data/deals.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
