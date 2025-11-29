// generate-mapping.js
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const {
  MOYSKLAD_BASE,
  MOYSKLAD_LOGIN,
  MOYSKLAD_PASSWORD,
  YANDEX_TOKEN,
  YANDEX_BUSINESS_ID,
  YANDEX_CAMPAIGN_ID
} = process.env;

if (!MOYSKLAD_BASE || !MOYSKLAD_LOGIN || !MOYSKLAD_PASSWORD) {
  console.error('❌ Не заполнены переменные MOYSKLAD_BASE, MOYSKLAD_LOGIN или MOYSKLAD_PASSWORD в .env!');
  process.exit(1);
}

if (!YANDEX_TOKEN || !YANDEX_BUSINESS_ID) {
  console.error('❌ Не заполнены переменные YANDEX_TOKEN или YANDEX_BUSINESS_ID в .env!');
  process.exit(1);
}

if (!YANDEX_CAMPAIGN_ID) {
  console.error('❌ Не заполнена переменная YANDEX_CAMPAIGN_ID в .env!');
  process.exit(1);
}

async function getMoySkladProducts() {
  const url = `${MOYSKLAD_BASE}/entity/product?limit=1000`;
  console.log('Запрос к МойСклад:', url);

  const res = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${MOYSKLAD_PASSWORD}`,
      'Accept': 'application/json;charset=utf-8'
    }
  });

  const data = res.data;
  console.log('Ответ МойСклад:', JSON.stringify(data, null, 2));

  if (!data.rows) {
    throw new Error('❌ data.rows не найдено! Проверь авторизацию и URL API.');
  }

  return data.rows.map(p => ({
    id: p.id,
    article: p.article,
    code: p.code,
    externalCode: p.externalCode,
    name: p.name
  }));
}

async function getYandexProducts() {
  // Используем POST /campaigns/{campaignId}/offers для получения товаров конкретного магазина
  const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offers`;
  console.log('Запрос к Яндекс.Маркет Campaign API:', url);
  console.log(`Campaign ID: ${YANDEX_CAMPAIGN_ID}`);

  try {
    let allOffers = [];
    let pageToken = '';
    let hasMore = true;
    let pageCount = 0;

    // Получаем все товары с пагинацией (максимум 50 страниц = ~5000 товаров)
    const MAX_PAGES = 50;
    while (hasMore && pageCount < MAX_PAGES) {
      // Параметры пагинации передаются в query parameters, а не в body!
      const params = {
        limit: 200
      };
      
      if (pageToken) {
        params.page_token = pageToken;
      }

      const res = await axios.post(url, {}, {
        params: params,
        headers: {
          'Authorization': `Bearer ${YANDEX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = res.data;
      const offers = data.result?.offers || [];
      allOffers = allOffers.concat(offers);
      
      pageCount++;
      console.log(`  Страница ${pageCount}: получено ${allOffers.length} товаров...`);
      
      // Проверяем, есть ли ещё страницы
      pageToken = data.result?.paging?.nextPageToken || '';
      hasMore = pageToken !== '';
    }
    
    if (pageCount >= MAX_PAGES && hasMore) {
      console.log(`⚠️ Достигнут лимит страниц (${MAX_PAGES}). Остановка загрузки.`);
    }

    console.log(`✅ Всего получено товаров из Campaign ID ${YANDEX_CAMPAIGN_ID}: ${allOffers.length}`);

    // Извлекаем SKU (shopSku/offerId) из каждого товара и убираем дубликаты
    const uniqueOffers = {};
    allOffers.forEach(offer => {
      const offerId = offer.shopSku || offer.offerId;
      if (offerId && !uniqueOffers[offerId]) {
        uniqueOffers[offerId] = {
          offerId: offerId,
          name: offer.name
        };
      }
    });
    
    const result = Object.values(uniqueOffers);
    console.log(`✅ Уникальных товаров (после удаления дубликатов): ${result.length}`);
    
    return result;
  } catch (err) {
    console.error('❌ Ошибка при получении товаров из Яндекс.Маркет:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
  }
}

async function generateMapping() {
  try {
    console.log('=== Начало генерации маппинга ===');
    
    // Получаем товары из обеих систем
    console.log('\n1. Получение товаров из МойСклад...');
    const moyskladProducts = await getMoySkladProducts();
    console.log(`✅ Получено товаров из МойСклад: ${moyskladProducts.length}`);
    
    console.log('\n2. Получение товаров из Яндекс.Маркет...');
    const yandexProducts = await getYandexProducts();
    console.log(`✅ Получено товаров из Яндекс.Маркет: ${yandexProducts.length}`);

    // Создаем индексы МойСклад товаров для быстрого поиска
    // Приоритет: 1) article, 2) code, 3) externalCode
    const moyskladByKey = {};
    moyskladProducts.forEach(p => {
      // Добавляем по артикулу (приоритет 1)
      if (p.article) {
        moyskladByKey[p.article] = p;
      }
      // Добавляем по коду (приоритет 2)
      if (p.code && !moyskladByKey[p.code]) {
        moyskladByKey[p.code] = p;
      }
      // Добавляем по внешнему коду (приоритет 3)
      if (p.externalCode && !moyskladByKey[p.externalCode]) {
        moyskladByKey[p.externalCode] = p;
      }
    });

    console.log(`\n3. Сопоставление товаров по article/code/externalCode (МойСклад) = offerId (Яндекс)...`);
    
    // Создаем маппинг: {yandexSKU: moyskladProductId}
    const mapping = {};
    let matchedCount = 0;
    const unmatchedYandex = [];

    yandexProducts.forEach(yandexProduct => {
      const offerId = yandexProduct.offerId;
      const moyskladProduct = moyskladByKey[offerId];
      
      if (moyskladProduct) {
        mapping[offerId] = moyskladProduct.id;
        matchedCount++;
        console.log(`  ✓ Сопоставлено: ${offerId} -> ${moyskladProduct.name}`);
      } else {
        unmatchedYandex.push(yandexProduct);
      }
    });

    console.log(`\n4. Результаты сопоставления:`);
    console.log(`  - Всего товаров в Яндекс.Маркет: ${yandexProducts.length}`);
    console.log(`  - Всего товаров в МойСклад: ${moyskladProducts.length}`);
    console.log(`  - Успешно сопоставлено: ${matchedCount}`);
    console.log(`  - Не сопоставлено (Яндекс): ${unmatchedYandex.length}`);

    if (unmatchedYandex.length > 0) {
      console.log('\n⚠️ Товары из Яндекс.Маркет без соответствия в МойСклад:');
      unmatchedYandex.forEach(p => {
        console.log(`  - offerId: ${p.offerId}, name: ${p.name || 'N/A'}`);
      });
    }

    // Сохраняем маппинг
    fs.writeFileSync('mapping.json', JSON.stringify(mapping, null, 2), 'utf-8');
    console.log('\n✅ mapping.json успешно создан!');
    console.log(`✅ Записано маппингов: ${Object.keys(mapping).length}`);
    
  } catch (err) {
    console.error('\n❌ Ошибка при генерации маппинга:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Запуск скрипта
generateMapping();
