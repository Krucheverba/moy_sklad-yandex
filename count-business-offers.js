// count-business-offers.js - Подсчет товаров
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID } = process.env;

async function countOffers() {
  try {
    const url = `https://api.partner.market.yandex.ru/businesses/${YANDEX_BUSINESS_ID}/offer-mappings`;
    
    let totalCount = 0;
    let pageToken = '';
    let pageNum = 0;
    
    console.log('Подсчет товаров...\n');
    
    // Получим только первые 5 страниц для теста
    while (pageNum < 5) {
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
      totalCount += offers.length;
      pageNum++;
      
      console.log(`Страница ${pageNum}: +${offers.length} товаров (всего: ${totalCount})`);
      
      pageToken = data.result?.paging?.nextPageToken || '';
      if (!pageToken) {
        console.log('\n✅ Это последняя страница!');
        break;
      }
    }
    
    console.log(`\n📊 Итого получено: ${totalCount} товаров`);
    
    if (pageToken) {
      console.log('⚠️ Есть еще страницы, но мы остановились на 5-й');
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

countOffers();
