# SteamDeal

Сайт актуальных скидок Steam: карточки, поиск, фильтр по скидке, цены **RU / KZ / UA / US**.

## Ссылки

- Репозиторий: https://github.com/Stintik-123/SteamDeal
- Сайт (после включения Pages): https://stintik-123.github.io/SteamDeal/

## Как включить сайт

1. **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder: `/ (root)`
4. Save

Через 1–2 минуты откроется `https://stintik-123.github.io/SteamDeal/`

## Как обновляются скидки

GitHub Action `Update Steam deals` раз в 6 часов (и вручную):

1. Тянет `featuredcategories` Steam по регионам
2. Пишет `data/deals.json`
3. Коммитит в `main`

**Actions → Update Steam deals → Run workflow** — обновить сразу.

Локально:

```bash
node scripts/update-deals.mjs
```

## Структура

```
index.html          — страница
assets/style.css    — стили
assets/app.js       — UI, фильтры
data/deals.json     — данные для сайта
scripts/update-deals.mjs
.github/workflows/update-deals.yml
```

Неофициальный проект. Цены ориентировочные, источник — публичный API Steam Store.
