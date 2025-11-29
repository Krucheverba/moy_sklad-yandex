// test-business-offers.js - Проверка товаров из Business API
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID } = process.env;

async function testBusinessOffers() {
  try {
    const url = `https://api.partner.market.yandex.ru/businesses/${YANDEX_BUSINESS_ID}/offer-mappings`;
    
    console.log('Запрос первой страницы...');
    const res = await axios.post(url, { limit: 10 }, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = res.data;
    console.log('\n📊 Результат:');
    console.log(`Получено товаров: ${data.result?.offerMappings?.length || 0}`);
    console.log(`Есть nextPageToken: ${!!data.result?.paging?.nextPageToken}`);
    
    console.log('\n📦 Первые 3 товара:');
    const offers = data.result?.offerMappings || [];
    offers.slice(0, 3).forEach((mapping, i) => {
      console.log(`\n${i + 1}. offerId: ${mapping.offer?.shopSku || mapping.offer?.offerId}`);
      console.log(`   name: ${mapping.offer?.name}`);
      console.log(`   mapping: ${JSON.stringify(mapping.mapping || {})}`);
    });

    // Проверим, есть ли дубликаты
    const offerIds = offers.map(m => m.offer?.shopSku || m.offer?.offerId);
    const uniqueIds = new Set(offerIds);
    console.log(`\n🔍 Уникальных ID: ${uniqueIds.size} из ${offerIds.length}`);
    
    if (uniqueIds.size < offerIds.length) {
      console.log('⚠️ Обнаружены дубликаты!');
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testBusinessOffers();
