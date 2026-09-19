// SteamDeals - Working MVP using CheapShark API
(function () {
  // Configuration
  const API_BASE = 'https://www.cheapshark.com/api/1.0';
  const DEALS_PER_PAGE = 20;
  
  // State
  let allDeals = [];
  let filteredDeals = [];
  let currentPage = 1;
  let favorites = JSON.parse(localStorage.getItem('steamDealsFavorites') || '[]');
  
  // DOM Elements
  const dealsGrid = document.getElementById('dealsGrid');
  const favoritesGrid = document.getElementById('favoritesGrid');
  const searchGrid = document.getElementById('searchGrid');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  const dealsStats = document.getElementById('dealsStats');
  const loadMoreRow = document.getElementById('loadMoreRow');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const priceFilter = document.getElementById('priceFilter');
  const discountFilter = document.getElementById('discountFilter');
  const sortFilter = document.getElementById('sortFilter');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  
  // Store logo mapping
  const storeLogos = {
    'Steam': '🎮',
    'GamersGate': '🎯',
    'GreenManGaming': '🐉',
    'Amazon': '📦',
    'GameStop': '🎲',
    'Direct2Drive': '🚀',
    'GOG': '✨',
    'Origin': '🌟',
    'Get Games': '🎁',
    'Shiny Loot': '💎',
    'HumbleStore': '😊',
    'Desura': '⚡',
    'Uplay': '🔷',
    'IndieGameStand': '🏆',
    'Fanatical': '🤩',
    'Gamesrocket': '🚀',
    'Games Republic': '👑',
    'SilaGames': '⚔️',
    'Playfield': '🎯',
    'ImperialGames': '👑',
    'WinGameStore': '🏆',
    'FunStockDigital': '🎭',
    'GameBillet': '🎫',
    'Voidu': '🌌',
    'Epic Game Store': '🦸',
    'Razer Game Store': '🐍',
    'Gamesplanet': '🪐',
    'Gamesload': '🎒',
    '2Game': '2️⃣',
    'IndieGala': '🎉',
    'Blizzard Shop': '❄️',
    'AllYouPlay': '🎮',
    'DLGamer': '🎧',
    'Noctre': '🦉',
    'DreamGame': '💭'
  };

  // Initialize
  init();

  function init() {
    loadDeals();
    setupEventListeners();
    renderFavorites();
    
    // Reveal animations
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('visible');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );
      reveals.forEach((el) => io.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('visible'));
    }
  }

  function setupEventListeners() {
    refreshBtn.addEventListener('click', loadDeals);
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });
    priceFilter.addEventListener('change', filterDeals);
    discountFilter.addEventListener('change', filterDeals);
    sortFilter.addEventListener('change', filterDeals);
    loadMoreBtn.addEventListener('click', loadMoreDeals);
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  async function loadDeals() {
    showLoading(true);
    hideError();
    
    try {
      const response = await fetch(`${API_BASE}/deals?storeID=1&upperPrice=50&pageSize=${DEALS_PER_PAGE}`);
      if (!response.ok) throw new Error('Failed to fetch deals');
      
      allDeals = await response.json();
      filteredDeals = [...allDeals];
      
      updateStats();
      renderDeals(filteredDeals.slice(0, DEALS_PER_PAGE));
      
      if (filteredDeals.length > DEALS_PER_PAGE) {
        loadMoreRow.style.display = 'flex';
        currentPage = 1;
      } else {
        loadMoreRow.style.display = 'none';
      }
    } catch (error) {
      showError('Ошибка загрузки скидок. Попробуйте позже.');
      console.error('Error loading deals:', error);
    } finally {
      showLoading(false);
    }
  }

  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      searchGrid.innerHTML = '<p class="empty-state">Введите название игры для поиска</p>';
      return;
    }
    
    searchGrid.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Поиск...</p></div>';
    
    try {
      const response = await fetch(`${API_BASE}/games?title=${encodeURIComponent(query)}&limit=20`);
      if (!response.ok) throw new Error('Search failed');
      
      const games = await response.json();
      
      if (games.length === 0) {
        searchGrid.innerHTML = '<p class="empty-state">Игры не найдены</p>';
        return;
      }
      
      // Get deal info for each game
      const dealPromises = games.map(async (game) => {
        if (game.deals && game.deals.length > 0) {
          return game.deals[0];
        }
        return null;
      });
      
      const deals = (await Promise.all(dealPromises)).filter(d => d !== null);
      
      if (deals.length === 0) {
        searchGrid.innerHTML = '<p class="empty-state">Скидки не найдены</p>';
        return;
      }
      
      searchGrid.innerHTML = '';
      deals.forEach(deal => {
        searchGrid.appendChild(createDealCard(deal));
      });
    } catch (error) {
      searchGrid.innerHTML = '<p class="empty-state">Ошибка поиска</p>';
      console.error('Search error:', error);
    }
  }

  function filterDeals() {
    const maxPrice = parseFloat(priceFilter.value);
    const minDiscount = parseFloat(discountFilter.value);
    const sortBy = sortFilter.value;
    
    filteredDeals = allDeals.filter(deal => {
      const price = parseFloat(deal.salePrice);
      const discount = parseFloat(deal.savings);
      
      if (maxPrice > 0 && price > maxPrice) return false;
      if (minDiscount > 0 && discount < minDiscount) return false;
      return true;
    });
    
    // Sort
    filteredDeals.sort((a, b) => {
      switch (sortBy) {
        case 'savings':
          return parseFloat(b.savings) - parseFloat(a.savings);
        case 'price':
          return parseFloat(a.salePrice) - parseFloat(b.salePrice);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'dealRating':
        default:
          return parseFloat(b.dealRating) - parseFloat(a.dealRating);
      }
    });
    
    updateStats();
    renderDeals(filteredDeals.slice(0, DEALS_PER_PAGE));
    
    if (filteredDeals.length > DEALS_PER_PAGE) {
      loadMoreRow.style.display = 'flex';
      currentPage = 1;
    } else {
      loadMoreRow.style.display = 'none';
    }
  }

  function loadMoreDeals() {
    currentPage++;
    const start = 0;
    const end = currentPage * DEALS_PER_PAGE;
    const newDeals = filteredDeals.slice(start, end);
    renderDeals(newDeals, false);
    
    if (end >= filteredDeals.length) {
      loadMoreRow.style.display = 'none';
    }
  }

  function renderDeals(deals, clear = true) {
    if (clear) {
      dealsGrid.innerHTML = '';
    }
    
    if (deals.length === 0) {
      if (clear) {
        dealsGrid.innerHTML = '<p class="empty-state">Скидки не найдены</p>';
      }
      return;
    }
    
    deals.forEach(deal => {
      dealsGrid.appendChild(createDealCard(deal));
    });
  }

  function createDealCard(deal) {
    const card = document.createElement('article');
    card.className = 'deal-card';
    
    const isFavorite = favorites.includes(deal.dealID);
    const discount = Math.round(parseFloat(deal.savings));
    const normalPrice = parseFloat(deal.normalPrice).toFixed(2);
    const salePrice = parseFloat(deal.salePrice).toFixed(2);
    const storeName = getStoreName(deal.storeID);
    const storeIcon = storeLogos[storeName] || '🏪';
    
    card.innerHTML = `
      <img class="deal-image" src="https://cdn.cloudflare.steamstatic.com/steam/apps/${getAppIdFromTitle(deal.title)}/header.jpg" alt="${deal.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 320 180%22%3E%3Crect fill=%22%231b2838%22 width=%22320%22 height=%22180%22/%3E%3Ctext fill=%22%235c7e10%22 font-family=%22sans-serif%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'"/>
      <div class="deal-discount">-${discount}%</div>
      <button class="deal-favorite-btn ${isFavorite ? 'active' : ''}" data-deal-id="${deal.dealID}" title="В избранное">
        ${isFavorite ? '❤️' : '🤍'}
      </button>
      <div class="deal-content">
        <h3 class="deal-title">${deal.title}</h3>
        <div class="deal-prices">
          <span class="deal-price-normal">$${normalPrice}</span>
          <span class="deal-price-current">$${salePrice}</span>
        </div>
        <div class="deal-meta">
          <span class="deal-store">${storeIcon} ${storeName}</span>
          <span class="deal-rating">★ ${(parseFloat(deal.dealRating) / 10).toFixed(1)}</span>
        </div>
      </div>
    `;
    
    // Event listeners
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('deal-favorite-btn')) {
        openModal(deal);
      }
    });
    
    const favBtn = card.querySelector('.deal-favorite-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(deal, favBtn);
    });
    
    return card;
  }

  function toggleFavorite(deal, btn) {
    const dealId = deal.dealID;
    const index = favorites.indexOf(dealId);
    
    if (index === -1) {
      favorites.push(dealId);
      btn.textContent = '❤️';
      btn.classList.add('active');
    } else {
      favorites.splice(index, 1);
      btn.textContent = '🤍';
      btn.classList.remove('active');
    }
    
    localStorage.setItem('steamDealsFavorites', JSON.stringify(favorites));
    renderFavorites();
  }

  function renderFavorites() {
    if (favorites.length === 0) {
      favoritesGrid.innerHTML = '<p class="empty-state">Нет избранных игр. Добавьте первую!</p>';
      return;
    }
    
    favoritesGrid.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    // Fetch favorite deals
    const dealIds = favorites.join(',');
    fetch(`${API_BASE}/deals?ids=${dealIds}`)
      .then(res => res.json())
      .then(deals => {
        if (deals.length === 0) {
          favoritesGrid.innerHTML = '<p class="empty-state">Нет избранных игр</p>';
          return;
        }
        
        favoritesGrid.innerHTML = '';
        deals.forEach(deal => {
          favoritesGrid.appendChild(createDealCard(deal));
        });
      })
      .catch(err => {
        console.error('Error loading favorites:', err);
        favoritesGrid.innerHTML = '<p class="empty-state">Ошибка загрузки</p>';
      });
  }

  async function openModal(deal) {
    const modalHeader = document.getElementById('modalHeader');
    const modalBody = document.getElementById('modalBody');
    const modalActions = document.getElementById('modalActions');
    
    const discount = Math.round(parseFloat(deal.savings));
    const normalPrice = parseFloat(deal.normalPrice).toFixed(2);
    const salePrice = parseFloat(deal.salePrice).toFixed(2);
    const storeName = getStoreName(deal.storeID);
    const steamUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(deal.title)}`;
    const dealUrl = `https://www.cheapshark.com/redirect.php?dealID=${deal.dealID}`;
    
    modalHeader.innerHTML = `
      <img src="https://cdn.cloudflare.steamstatic.com/steam/apps/${getAppIdFromTitle(deal.title)}/library_hero.jpg" alt="${deal.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 600 338%22%3E%3Crect fill=%22%231b2838%22 width=%22600%22 height=%22338%22/%3E%3Ctext fill=%22%235c7e10%22 font-family=%22sans-serif%22 font-size=%2232%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3E${encodeURIComponent(deal.title.substring(0, 30))}%3C/text%3E%3C/svg%3E'"/>
    `;
    
    modalBody.innerHTML = `
      <h2 class="modal-title">${deal.title}</h2>
      <div class="modal-info">
        <div class="modal-info-item">
          <div class="modal-info-label">Цена</div>
          <div class="modal-info-value" style="color: var(--accent2);">$${salePrice} <span style="font-size:0.8em;color:var(--muted);text-decoration:line-through;">$${normalPrice}</span></div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">Скидка</div>
          <div class="modal-info-value" style="color: var(--discount-red);">-${discount}%</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">Магазин</div>
          <div class="modal-info-value">${storeName}</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">Рейтинг</div>
          <div class="modal-info-value" style="color: var(--accent);">★ ${(parseFloat(deal.dealRating) / 10).toFixed(1)}</div>
        </div>
      </div>
    `;
    
    modalActions.innerHTML = `
      <a class="btn btn-primary" href="${dealUrl}" target="_blank" rel="noopener">Купить за $${salePrice}</a>
      <a class="btn" href="${steamUrl}" target="_blank" rel="noopener">Найти в Steam</a>
    `;
    
    modalOverlay.style.display = 'grid';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function updateStats() {
    const avgDiscount = filteredDeals.length > 0 
      ? (filteredDeals.reduce((sum, d) => sum + parseFloat(d.savings), 0) / filteredDeals.length).toFixed(1)
      : 0;
    const bestDeal = filteredDeals.length > 0 
      ? filteredDeals.reduce((best, d) => parseFloat(d.savings) > parseFloat(best.savings) ? d : best)
      : null;
    
    dealsStats.innerHTML = `
      <span class="pill pill-stat">📊 Найдено: ${filteredDeals.length}</span>
      <span class="pill pill-stat">💰 Средняя скидка: ${avgDiscount}%</span>
      ${bestDeal ? `<span class="pill pill-stat">🔥 Лучшая: ${bestDeal.title}</span>` : ''}
    `;
  }

  function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
    if (show) {
      dealsGrid.style.display = 'none';
    } else {
      dealsGrid.style.display = 'grid';
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    dealsGrid.style.display = 'none';
  }

  function hideError() {
    errorMessage.style.display = 'none';
  }

  function getStoreName(storeId) {
    const stores = {
      '1': 'Steam',
      '2': 'GamersGate',
      '3': 'GreenManGaming',
      '4': 'Amazon',
      '5': 'GameStop',
      '6': 'Direct2Drive',
      '7': 'GOG',
      '8': 'Origin',
      '9': 'Get Games',
      '10': 'Shiny Loot',
      '11': 'HumbleStore',
      '12': 'Desura',
      '13': 'Uplay',
      '14': 'IndieGameStand',
      '15': 'Fanatical',
      '16': 'Gamesrocket',
      '17': 'Games Republic',
      '18': 'SilaGames',
      '19': 'Playfield',
      '20': 'ImperialGames',
      '21': 'WinGameStore',
      '22': 'FunStockDigital',
      '23': 'GameBillet',
      '24': 'Voidu',
      '25': 'Epic Game Store',
      '26': 'Razer Game Store',
      '27': 'Gamesplanet',
      '28': 'Gamesload',
      '29': '2Game',
      '30': 'IndieGala',
      '31': 'Blizzard Shop',
      '32': 'AllYouPlay',
      '33': 'DLGamer',
      '34': 'Noctre',
      '35': 'DreamGame'
    };
    return stores[storeId] || 'Unknown Store';
  }

  function getAppIdFromTitle(title) {
    // This is a workaround since CheapShark doesn't provide Steam App IDs directly
    // In production, you'd want to cache or use a proper mapping service
    return '0'; // Will trigger the fallback image
  }

})();
