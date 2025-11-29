// find-product.js - Поиск конкретного товара
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID } = process.env;
const SEARCH_SKU = 'Takayama-Adaptec-5w-40-4L';

async function findProduct() {
  try {
    const url = `https://api.partner.market.yandex.ru/businesses/${YANDEX_BUSINESS_ID}/offer-mappings`;
    
    console.log(`Поиск товара: ${SEARCH_SKU}\n`);
    
    let found = false;
    let pageToken = '';
    let pageNum = 0;
    const MAX_PAGES = 20;
    
    while (pageNum < MAX_PAGES && !found) {
      const requestBody = { limit: 200 };
      if (pageToken) {
        requestBody.page_token = pageToken;
      }

      const res = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${YANDEX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = res.data;
      const offers = data.result?.offerMappings || [];
      
      pageNum++;
      console.log(`Страница ${pageNum}: проверка ${offers.length} товаров...`);
      
      // Ищем товар
      const match = offers.find(m => {
        const offerId = m.offer?.shopSku || m.offer?.offerId;
        return offerId === SEARCH_SKU || offerId?.includes('Takayama');
      });
      
      if (match) {
        found = true;
        console.log('\n✅ Товар найден!');
        console.log(`offerId: ${match.offer?.shopSku || match.offer?.offerId}`);
        console.log(`name: ${match.offer?.name}`);
        console.log(`\nПолная структура:`);
        console.log(JSON.stringify(match, null, 2));
        break;
      }
      
      pageToken = data.result?.paging?.nextPageToken || '';
      if (!pageToken) break;
    }
    
    if (!found) {
      console.log(`\n❌ Товар "${SEARCH_SKU}" не найден в первых ${pageNum} страницах`);
      console.log('\nПопробуем найти похожие товары с "Takayama"...');
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

findProduct();
