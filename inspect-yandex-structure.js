// inspect-yandex-structure.js - Проверка структуры данных Яндекса
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID } = process.env;

async function inspectStructure() {
  try {
    const url = `https://api.partner.market.yandex.ru/businesses/${YANDEX_BUSINESS_ID}/offer-mappings`;
    
    console.log('Получение первых 3 товаров для анализа структуры...\n');
    
    const res = await axios.post(url, { limit: 3 }, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const offers = res.data.result?.offerMappings || [];
    
    console.log(`Получено товаров: ${offers.length}\n`);
    
    offers.forEach((mapping, i) => {
      console.log(`\n========== Товар ${i + 1} ==========`);
      console.log('Полная структура:');
      console.log(JSON.stringify(mapping, null, 2));
      console.log('\n--- Извлеченные поля ---');
      console.log(`offer.shopSku: ${mapping.offer?.shopSku}`);
      console.log(`offer.offerId: ${mapping.offer?.offerId}`);
      console.log(`offer.name: ${mapping.offer?.name}`);
      console.log(`offer.marketSku: ${mapping.offer?.marketSku}`);
    });

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

inspectStructure();
