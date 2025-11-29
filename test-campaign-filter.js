// test-campaign-filter.js - Проверка фильтрации по магазину
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID, YANDEX_CAMPAIGN_ID } = process.env;

async function testFilters() {
  console.log(`Business ID: ${YANDEX_BUSINESS_ID}`);
  console.log(`Campaign ID: ${YANDEX_CAMPAIGN_ID}\n`);

  // Вариант 1: Попробуем добавить campaignId в body
  try {
    console.log('=== Вариант 1: campaignId в body ===');
    const url = `https://api.partner.market.yandex.ru/businesses/${YANDEX_BUSINESS_ID}/offer-mappings`;
    
    const res = await axios.post(url, {
      limit: 10,
      campaignId: parseInt(YANDEX_CAMPAIGN_ID)
    }, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const offers = res.data.result?.offerMappings || [];
    console.log(`✅ Получено товаров: ${offers.length}`);
    
    // Проверим, есть ли в ответе информация о магазине
    if (offers.length > 0) {
      console.log('\nПример товара:');
      console.log(JSON.stringify(offers[0], null, 2));
    }
  } catch (err) {
    console.log(`❌ Ошибка: ${err.response?.status} - ${err.response?.data?.errors?.[0]?.message || err.message}`);
  }

  // Вариант 2: Попробуем через Campaign API
  try {
    console.log('\n=== Вариант 2: Campaign API /offers ===');
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offers`;
    
    const res = await axios.post(url, {
      limit: 10
    }, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const offers = res.data.result?.offers || [];
    console.log(`✅ Получено товаров: ${offers.length}`);
    
    if (offers.length > 0) {
      console.log('\nПример товара:');
      console.log(`offerId: ${offers[0].shopSku || offers[0].offerId}`);
      console.log(`name: ${offers[0].name}`);
    }
  } catch (err) {
    console.log(`❌ Ошибка: ${err.response?.status} - ${err.response?.data?.errors?.[0]?.message || err.message}`);
  }

  // Вариант 3: Попробуем через Campaign API /offer-mapping-entries
  try {
    console.log('\n=== Вариант 3: Campaign API /offer-mapping-entries ===');
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offer-mapping-entries`;
    
    const res = await axios.get(url, {
      params: { limit: 10 },
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const entries = res.data.result?.offerMappingEntries || [];
    console.log(`✅ Получено товаров: ${entries.length}`);
    
    if (entries.length > 0) {
      console.log('\nПример товара:');
      console.log(`offerId: ${entries[0].offer?.shopSku || entries[0].offer?.offerId}`);
      console.log(`name: ${entries[0].offer?.name}`);
    }
  } catch (err) {
    console.log(`❌ Ошибка: ${err.response?.status} - ${err.response?.data?.errors?.[0]?.message || err.message}`);
  }
}

testFilters();
