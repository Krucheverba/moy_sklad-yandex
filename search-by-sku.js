// search-by-sku.js - Поиск товара по SKU через Campaign API
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_CAMPAIGN_ID } = process.env;
const SEARCH_SKU = 'Takayama-Adaptec-5w-40-4L';

async function searchBySKU() {
  try {
    // Попробуем метод GET /campaigns/{campaignId}/offers
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offers`;
    
    console.log(`Поиск товара "${SEARCH_SKU}" в Campaign ${YANDEX_CAMPAIGN_ID}...\n`);
    
    let found = false;
    let pageToken = '';
    let pageNum = 0;
    const MAX_PAGES = 10;
    
    while (pageNum < MAX_PAGES && !found) {
      const requestBody = { 
        limit: 200,
        page_token: pageToken || undefined
      };

      const res = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${YANDEX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = res.data;
      const offers = data.result?.offers || [];
      
      pageNum++;
      console.log(`Страница ${pageNum}: проверка ${offers.length} товаров...`);
      
      // Ищем товар
      const match = offers.find(offer => {
        const offerId = offer.shopSku || offer.offerId;
        return offerId === SEARCH_SKU || offerId?.includes('Takayama');
      });
      
      if (match) {
        found = true;
        console.log('\n✅ Товар найден!');
        console.log(`offerId/shopSku: ${match.shopSku || match.offerId}`);
        console.log(`name: ${match.name}`);
        console.log(`\nПолная структура:`);
        console.log(JSON.stringify(match, null, 2));
        break;
      }
      
      pageToken = data.result?.paging?.nextPageToken || '';
      if (!pageToken) {
        console.log('\n✅ Достигнут конец списка');
        break;
      }
    }
    
    if (!found) {
      console.log(`\n❌ Товар "${SEARCH_SKU}" не найден в Campaign ${YANDEX_CAMPAIGN_ID}`);
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

searchBySKU();
