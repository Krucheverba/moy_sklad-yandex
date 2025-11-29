// find-all-takayama.js - Поиск всех товаров Takayama
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID } = process.env;

async function findAllTakayama() {
  try {
    const url = `https://api.partner.market.yandex.ru/businesses/${YANDEX_BUSINESS_ID}/offer-mappings`;
    
    console.log('Поиск всех товаров Takayama...\n');
    
    const takayamaProducts = [];
    let pageToken = '';
    let pageNum = 0;
    const MAX_PAGES = 50;
    
    while (pageNum < MAX_PAGES) {
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
      
      // Ищем товары Takayama
      offers.forEach(m => {
        const offerId = m.offer?.offerId;
        const name = m.offer?.name || '';
        
        if (name.toLowerCase().includes('takayama') || offerId?.toLowerCase().includes('takayama')) {
          takayamaProducts.push({
            offerId: offerId,
            name: name
          });
        }
      });
      
      if (takayamaProducts.length > 0) {
        console.log(`Страница ${pageNum}: найдено ${takayamaProducts.length} товаров Takayama`);
      }
      
      pageToken = data.result?.paging?.nextPageToken || '';
      if (!pageToken) {
        console.log(`\n✅ Достигнут конец списка на странице ${pageNum}`);
        break;
      }
    }
    
    console.log(`\n📊 Всего найдено товаров Takayama: ${takayamaProducts.length}\n`);
    
    if (takayamaProducts.length > 0) {
      console.log('Список товаров Takayama в Яндексе:\n');
      takayamaProducts.forEach((p, i) => {
        console.log(`${i + 1}. offerId: ${p.offerId}`);
        console.log(`   name: ${p.name}`);
        console.log('');
      });
    } else {
      console.log('❌ Товары Takayama не найдены в Яндексе');
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

findAllTakayama();
