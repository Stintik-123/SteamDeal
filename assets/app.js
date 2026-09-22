const DATA_URL = "data/deals.json";
const POPULAR_URL = "data/popular.json";

const PAGE_SIZE = 24;

const state = {
  deals: [],
  popular: new Set(),
  filtered: [],
  visible: PAGE_SIZE,

  search: "",
  region: localStorage.getItem("steamdeal-region") || "ru",
  sort: localStorage.getItem("steamdeal-sort") || "discount",

  minDiscount: Number(localStorage.getItem("steamdeal-discount") || 0),

  popularOnly: localStorage.getItem("steamdeal-popular") === "1",
  pricedOnly: localStorage.getItem("steamdeal-priced") === "1",
  favoritesOnly: false,

  favorites: new Set(
    JSON.parse(localStorage.getItem("steamdeal-favorites") || "[]")
      .map(String)
  ),

  view: localStorage.getItem("steamdeal-view") || "grid"
};


const els = {
  heroCount: document.querySelector("#heroCount"),
  heroUpdated: document.querySelector("#heroUpdated"),

  topGrid: document.querySelector("#topGrid"),
  freeGrid: document.querySelector("#freeGrid"),

  dealGrid: document.querySelector("#dealGrid"),
  emptyState: document.querySelector("#emptyState"),

  searchInput: document.querySelector("#searchInput"),
  regionSelect: document.querySelector("#regionSelect"),
  sortSelect: document.querySelector("#sortSelect"),

  discountRange: document.querySelector("#discountRange"),
  discountValue: document.querySelector("#discountValue"),

  popularOnly: document.querySelector("#popularOnly"),
  pricedOnly: document.querySelector("#pricedOnly"),

  resultsCount: document.querySelector("#resultsCount"),
  favoritesCount: document.querySelector("#favoritesCount"),
  favoritesToggle: document.querySelector("#favoritesToggle"),

  loadMore: document.querySelector("#loadMore"),

  randomBtn: document.querySelector("#randomBtn"),
  heroRandomBtn: document.querySelector("#heroRandomBtn"),

  resetFilters: document.querySelector("#resetFilters"),
  emptyReset: document.querySelector("#emptyReset"),

  themeBtn: document.querySelector("#themeBtn"),
  backTop: document.querySelector("#backTop"),
  toast: document.querySelector("#toast")
};


function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}


function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function getAppId(deal) {
  return String(
    deal.appid ??
    deal.appId ??
    deal.id ??
    ""
  );
}


function getName(deal) {
  return (
    deal.name ??
    deal.title ??
    "Без названия"
  );
}


function getDiscount(deal) {
  return number(
    deal.discount_percent ??
    deal.discountPercent ??
    deal.discount ??
    deal.percent ??
    0
  );
}


function getImage(deal) {
  return (
    deal.header ??
    deal.header_image ??
    deal.headerImage ??
    deal.image ??
    deal.capsule ??
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${getAppId(deal)}/header.jpg`
  );
}


function getOriginalPrice(deal) {
  const region = state.region;

  const prices =
    deal.prices ??
    deal.regions ??
    deal.region_prices ??
    {};

  const regionData = prices?.[region];

  if (regionData && typeof regionData === "object") {
    return number(
      regionData.initial ??
      regionData.original ??
      regionData.original_price ??
      regionData.old_price ??
      regionData.full ??
      0
    );
  }

  return number(
    deal.initial_price ??
    deal.initialPrice ??
    deal.original_price ??
    deal.originalPrice ??
    0
  );
}


function getFinalPrice(deal) {
  const region = state.region;

  const prices =
    deal.prices ??
    deal.regions ??
    deal.region_prices ??
    {};

  const regionData = prices?.[region];

  if (regionData && typeof regionData === "object") {
    return number(
      regionData.final ??
      regionData.price ??
      regionData.current ??
      regionData.sale_price ??
      0
    );
  }

  return number(
    deal.final_price ??
    deal.finalPrice ??
    deal.price ??
    deal.current_price ??
    0
  );
}


function getSavings(deal) {
  const original = getOriginalPrice(deal);
  const current = getFinalPrice(deal);

  if (original > current && current >= 0) {
    return original - current;
  }

  return number(
    deal.savings ??
    deal.savings_amount ??
    0
  );
}


function formatPrice(value) {
  const n = number(value);

  if (n <= 0) {
    return "Бесплатно";
  }

  const currencies = {
    ru: "₽",
    kz: "₸",
    ua: "₴",
    us: "$"
  };

  const currency = currencies[state.region] || "₽";

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  }).format(n)} ${currency}`;
}


function getStoreUrl(deal) {
  if (deal.url) return deal.url;

  const appid = getAppId(deal);

  return appid
    ? `https://store.steampowered.com/app/${encodeURIComponent(appid)}/`
    : "https://store.steampowered.com/";
}


function getTrailer(deal) {
  return (
    deal.trailer ??
    deal.trailer_url ??
    deal.trailerUrl ??
    deal.movies?.[0]?.mp4?.max ??
    deal.movies?.[0]?.mp4?.["480"] ??
    ""
  );
}


function isPopular(deal) {
  const id = getAppId(deal);

  if (state.popular.has(id)) return true;

  return getDiscount(deal) >= 70;
}


function hasPrice(deal) {
  return getFinalPrice(deal) > 0 || getOriginalPrice(deal) > 0;
}


function saveState() {
  localStorage.setItem("steamdeal-region", state.region);
  localStorage.setItem("steamdeal-sort", state.sort);
  localStorage.setItem("steamdeal-discount", String(state.minDiscount));
  localStorage.setItem("steamdeal-popular", state.popularOnly ? "1" : "0");
  localStorage.setItem("steamdeal-priced", state.pricedOnly ? "1" : "0");
  localStorage.setItem(
    "steamdeal-favorites",
    JSON.stringify([...state.favorites])
  );
  localStorage.setItem("steamdeal-view", state.view);
}


function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2200);
}


function setTheme() {
  const saved = localStorage.getItem("steamdeal-theme");

  if (saved === "light") {
    document.body.classList.add("light-theme");
  }
}


function toggleTheme() {
  const light = document.body.classList.toggle("light-theme");

  localStorage.setItem(
    "steamdeal-theme",
    light ? "light" : "dark"
  );
}


function saveFavorites() {
  localStorage.setItem(
    "steamdeal-favorites",
    JSON.stringify([...state.favorites])
  );
}


function updateFavoritesCounter() {
  els.favoritesCount.textContent = state.favorites.size;
}


function toggleFavorite(appid) {
  const id = String(appid);

  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    showToast("Удалено из избранного");
  } else {
    state.favorites.add(id);
    showToast("Добавлено в избранное");
  }

  saveFavorites();
  updateFavoritesCounter();
  renderCatalog();
}


function getCardMarkup(deal, compact = false) {
  const appid = getAppId(deal);
  const name = getName(deal);
  const discount = Math.round(getDiscount(deal));

  const original = getOriginalPrice(deal);
  const finalPrice = getFinalPrice(deal);
  const savings = getSavings(deal);

  const image = getImage(deal);
  const trailer = getTrailer(deal);

  const popular = isPopular(deal);
  const favorite = state.favorites.has(appid);

  const storeUrl = getStoreUrl(deal);

  const priceMarkup = finalPrice > 0
    ? `
      <div class="price-block">
        ${original > finalPrice
          ? `<span class="old-price">${esc(formatPrice(original))}</span>`
          : ""
        }
        <strong>${esc(formatPrice(finalPrice))}</strong>
      </div>
    `
    : `
      <div class="price-block">
        <strong class="free-price">Бесплатно</strong>
      </div>
    `;

  const savingsMarkup = savings > 0
    ? `<span class="saving">−${esc(formatPrice(savings))}</span>`
    : "";

  const badges = `
    ${discount > 0
      ? `<span class="discount-badge">−${discount}%</span>`
      : ""
    }
    ${popular
      ? `<span class="popular-badge">★ Популярная</span>`
      : ""
    }
  `;

  return `
    <article
      class="deal-card ${compact ? "compact" : ""}"
      data-appid="${esc(appid)}"
      data-trailer="${esc(trailer)}"
    >

      <div class="card-media">
        <a
          href="${esc(storeUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="card-image-link"
        >
          <img
            class="card-image"
            src="${esc(image)}"
            alt="${esc(name)}"
            loading="lazy"
          >

          <span class="card-badges">
            ${badges}
          </span>
        </a>

        <button
          class="favorite-button ${favorite ? "active" : ""}"
          data-favorite="${esc(appid)}"
          type="button"
          aria-label="${favorite ? "Убрать из избранного" : "Добавить в избранное"}"
        >
          ${favorite ? "♥" : "♡"}
        </button>

        <div class="trailer-preview"></div>
      </div>

      <div class="card-content">

        <div class="card-title-row">
          <a
            class="deal-title"
            href="${esc(storeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${esc(name)}
          </a>
        </div>

        <div class="card-bottom">
          ${priceMarkup}
          ${savingsMarkup}
        </div>

      </div>

    </article>
  `;
}


function getTopDeals() {
  return [...state.deals]
    .filter(deal => getDiscount(deal) > 0)
    .sort((a, b) => {
      const aScore =
        getDiscount(a) * 1.25 +
        Math.min(getSavings(a) / 100, 40) +
        (isPopular(a) ? 18 : 0);

      const bScore =
        getDiscount(b) * 1.25 +
        Math.min(getSavings(b) / 100, 40) +
        (isPopular(b) ? 18 : 0);

      return bScore - aScore;
    })
    .slice(0, 4);
}


function getFreeDeals() {
  return state.deals
    .filter(deal => {
      const discount = getDiscount(deal);
      const price = getFinalPrice(deal);

      return price === 0 && discount >= 0;
    })
    .slice(0, 6);
}


function renderTop() {
  const deals = getTopDeals();

  if (!deals.length) {
    els.topGrid.innerHTML = `
      <div class="section-empty">
        Пока нет данных для топа.
      </div>
    `;
    return;
  }

  els.topGrid.innerHTML = deals
    .map(deal => getCardMarkup(deal, true))
    .join("");

  bindCardEvents(els.topGrid);
}


function renderFree() {
  const deals = getFreeDeals();

  if (!deals.length) {
    els.freeGrid.innerHTML = `
      <div class="section-empty">
        Бесплатных предложений сейчас не найдено.
      </div>
    `;
    return;
  }

  els.freeGrid.innerHTML = deals
    .map(deal => getCardMarkup(deal, true))
    .join("");

  bindCardEvents(els.freeGrid);
}


function applyFilters() {
  const query = normalize(state.search);

  let result = state.deals.filter(deal => {

    const name = normalize(getName(deal));

    if (query && !name.includes(query)) {
      return false;
    }

    if (getDiscount(deal) < state.minDiscount) {
      return false;
    }

    if (state.popularOnly && !isPopular(deal)) {
      return false;
    }

    if (state.pricedOnly && !hasPrice(deal)) {
      return false;
    }

    if (state.favoritesOnly && !state.favorites.has(getAppId(deal))) {
      return false;
    }

    return true;
  });


  result.sort((a, b) => {

    switch (state.sort) {

      case "price":
        return getFinalPrice(a) - getFinalPrice(b);

      case "savings":
        return getSavings(b) - getSavings(a);

      case "name":
        return getName(a).localeCompare(
          getName(b),
          "ru",
          { sensitivity: "base" }
        );

      case "discount":
      default:
        return getDiscount(b) - getDiscount(a);
    }

  });


  state.filtered = result;
}


function renderCatalog() {
  applyFilters();

  state.visible = Math.min(
    Math.max(PAGE_SIZE, state.visible),
    state.filtered.length
  );

  const visibleDeals = state.filtered.slice(0, state.visible);

  els.dealGrid.classList.toggle(
    "list-view",
    state.view === "list"
  );

  els.dealGrid.innerHTML = visibleDeals
    .map(deal => getCardMarkup(deal))
    .join("");

  const total = state.filtered.length;

  if (state.favoritesOnly) {
    els.resultsCount.textContent =
      `${total} избранных ${plural(total, "игра", "игры", "игр")}`;
  } else {
    els.resultsCount.textContent =
      `${total} ${plural(total, "предложение", "предложения", "предложений")}`;
  }

  els.emptyState.classList.toggle(
    "hidden",
    total !== 0
  );

  els.dealGrid.classList.toggle(
    "hidden",
    total === 0
  );

  els.loadMore.classList.toggle(
    "hidden",
    state.visible >= total || total === 0
  );

  bindCardEvents(els.dealGrid);

  updateFavoritesCounter();
}


function plural(numberValue, one, few, many) {
  const n = Math.abs(numberValue) % 100;
  const n1 = n % 10;

  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;

  return many;
}


function bindCardEvents(container) {

  container.querySelectorAll("[data-favorite]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      toggleFavorite(button.dataset.favorite);
    });
  });


  container.querySelectorAll(".deal-card").forEach(card => {

    const trailer = card.dataset.trailer;
    const preview = card.querySelector(".trailer-preview");

    if (!trailer || !preview) return;

    let timer;

    card.addEventListener("mouseenter", () => {
      timer = setTimeout(() => {

        if (preview.querySelector("video")) return;

        const video = document.createElement("video");

        video.src = trailer;
        video.muted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;

        preview.appendChild(video);

      }, 300);
    });

    card.addEventListener("mouseleave", () => {
      clearTimeout(timer);
      preview.innerHTML = "";
    });

  });
}


function syncControls() {
  els.regionSelect.value = state.region;
  els.sortSelect.value = state.sort;

  els.discountRange.value = state.minDiscount;
  els.discountValue.textContent = state.minDiscount;

  els.popularOnly.checked = state.popularOnly;
  els.pricedOnly.checked = state.pricedOnly;

  document.querySelectorAll(".quick-filter").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.dataset.discount) === state.minDiscount
    );
  });

  document.querySelectorAll(".view-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === state.view
    );
  });

  els.favoritesToggle.classList.toggle(
    "active",
    state.favoritesOnly
  );
}


function refresh() {
  saveState();
  syncControls();
  renderCatalog();
}


function resetFilters() {
  state.search = "";
  state.minDiscount = 0;
  state.popularOnly = false;
  state.pricedOnly = false;
  state.favoritesOnly = false;
  state.sort = "discount";

  els.searchInput.value = "";

  refresh();
}


function randomDeal() {
  const pool = state.filtered.length
    ? state.filtered
    : state.deals;

  if (!pool.length) return;

  const deal = pool[
    Math.floor(Math.random() * pool.length)
  ];

  const url = getStoreUrl(deal);

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  showToast(`Открываем: ${getName(deal)}`);
}


async function loadPopular() {
  try {
    const response = await fetch(POPULAR_URL, {
      cache: "no-store"
    });

    if (!response.ok) return;

    const data = await response.json();

    const ids = Array.isArray(data)
      ? data
      : Array.isArray(data?.appids)
        ? data.appids
        : [];

    state.popular = new Set(ids.map(String));

  } catch {
    state.popular = new Set();
  }
}


async function loadDeals() {

  try {

    const response = await fetch(DATA_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      state.deals = data;
    } else if (Array.isArray(data?.deals)) {
      state.deals = data.deals;
    } else if (Array.isArray(data?.items)) {
      state.deals = data.items;
    } else {
      throw new Error("Неизвестный формат deals.json");
    }


    els.heroCount.textContent =
      state.deals.length.toLocaleString("ru-RU");


    const updated =
      data?.updated_at ??
      data?.updatedAt ??
      data?.generated_at ??
      data?.generatedAt ??
      null;


    if (updated) {
      const date = new Date(updated);

      if (!Number.isNaN(date.getTime())) {
        els.heroUpdated.textContent =
          date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit"
          });
      }
    }


    renderTop();
    renderFree();
    renderCatalog();

  } catch (error) {

    console.error(error);

    els.heroCount.textContent = "—";
    els.resultsCount.textContent = "Ошибка загрузки";

    els.dealGrid.innerHTML = `
      <div class="error-state">
        <div class="empty-icon">!</div>
        <h3>Не удалось загрузить скидки</h3>
        <p>
          Проверь подключение к интернету или попробуй
          обновить страницу чуть позже.
        </p>
        <button class="secondary-button" onclick="location.reload()">
          Обновить
        </button>
      </div>
    `;

  }

}


function initEvents() {

  els.searchInput.addEventListener("input", event => {
    state.search = event.target.value;
    state.visible = PAGE_SIZE;
    renderCatalog();
  });


  els.regionSelect.addEventListener("change", event => {
    state.region = event.target.value;
    state.visible = PAGE_SIZE;

    saveState();

    renderTop();
    renderFree();
    renderCatalog();
  });


  els.sortSelect.addEventListener("change", event => {
    state.sort = event.target.value;
    state.visible = PAGE_SIZE;

    refresh();
  });


  els.discountRange.addEventListener("input", event => {
    state.minDiscount = Number(event.target.value);
    state.visible = PAGE_SIZE;

    refresh();
  });


  document.querySelectorAll(".quick-filter").forEach(button => {

    button.addEventListener("click", () => {

      state.minDiscount =
        Number(button.dataset.discount);

      state.visible = PAGE_SIZE;

      refresh();

    });

  });


  els.popularOnly.addEventListener("change", event => {
    state.popularOnly = event.target.checked;
    state.visible = PAGE_SIZE;

    refresh();
  });


  els.pricedOnly.addEventListener("change", event => {
    state.pricedOnly = event.target.checked;
    state.visible = PAGE_SIZE;

    refresh();
  });


  els.favoritesToggle.addEventListener("click", () => {

    state.favoritesOnly = !state.favoritesOnly;
    state.visible = PAGE_SIZE;

    refresh();

  });


  document.querySelectorAll(".view-button").forEach(button => {

    button.addEventListener("click", () => {

      state.view = button.dataset.view;

      refresh();

    });

  });


  els.loadMore.addEventListener("click", () => {

    state.visible += PAGE_SIZE;

    renderCatalog();

  });


  els.resetFilters.addEventListener(
    "click",
    resetFilters
  );

  els.emptyReset.addEventListener(
    "click",
    resetFilters
  );


  els.randomBtn.addEventListener(
    "click",
    randomDeal
  );

  els.heroRandomBtn.addEventListener(
    "click",
    randomDeal
  );


  els.themeBtn.addEventListener(
    "click",
    toggleTheme
  );


  document.addEventListener("keydown", event => {

    if (
      event.key === "/" &&
      document.activeElement !== els.searchInput &&
      !event.ctrlKey 
