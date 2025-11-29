// check-offer-structure.js - Проверка структуры товара
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_CAMPAIGN_ID } = process.env;

async function checkStructure() {
  try {
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offers`;
    
    const res = await axios.post(url, { limit: 3 }, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const offers = res.data.result?.offers || [];
    
    console.log(`Получено товаров: ${offers.length}\n`);
    console.log('Структура первого товара:');
    console.log(JSON.stringify(offers[0], null, 2));

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

checkStructure();
