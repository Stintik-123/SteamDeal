# SteamDeal

Полноценный сайт скидок Steam: specials, цены RU/KZ/UA/US, чёрно-белый UI.

## Сайт

**Settings → Pages → main / (root)**  
https://stintik-123.github.io/SteamDeal/

## Что умеет

- Сбор specials через Steam Search (сотни игр)
- Мультивалюта + appdetails для топа скидок
- Поиск, сортировка, фильтр %, чипы −50/−70/−90
- «Только с ценой в регионе»
- Actions каждые 6 часов

## Полный список скидок

**Actions → Update Steam deals → Run workflow**

Подтянет ~300 specials. Скрипт: `node scripts/update-deals.mjs`

Неофициальный проект. Источник — публичные данные Steam Store.
