// test-campaign-offers.js - Получение товаров через Campaign API
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_CAMPAIGN_ID } = process.env;

async function testCampaignOffers() {
  try {
    // Попробуем получить товары через Campaign API
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offers`;
    
    console.log(`Запрос товаров для магазина ${YANDEX_CAMPAIGN_ID}...\n`);
    
    const res = await axios.post(url, { 
      limit: 10,
      page_token: ''
    }, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = res.data;
    console.log('📊 Результат:');
    console.log(`Получено товаров: ${data.result?.offers?.length || 0}`);
    console.log(`Есть nextPageToken: ${!!data.result?.paging?.nextPageToken}`);
    
    console.log('\n📦 Первые 3 товара:');
    const offers = data.result?.offers || [];
    offers.slice(0, 3).forEach((offer, i) => {
      console.log(`\n${i + 1}. offerId: ${offer.shopSku || offer.offerId}`);
      console.log(`   name: ${offer.name}`);
    });

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testCampaignOffers();
