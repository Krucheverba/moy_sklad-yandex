// get-campaigns.js - Скрипт для получения списка кампаний из Яндекс.Маркет
require('dotenv').config();
const axios = require('axios');

const YANDEX_TOKEN = process.env.YANDEX_TOKEN;

if (!YANDEX_TOKEN) {
  console.error('❌ YANDEX_TOKEN не найден в .env!');
  process.exit(1);
}

async function getCampaigns() {
  try {
    const url = 'https://api.partner.market.yandex.ru/campaigns';
    console.log('Запрос к Яндекс.Маркет API для получения списка кампаний...');
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `OAuth ${YANDEX_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    console.log('\n✅ Успешно получены кампании:');
    console.log(JSON.stringify(res.data, null, 2));
    
    if (res.data.campaigns && res.data.campaigns.length > 0) {
      console.log('\n📋 Список ваших кампаний:');
      res.data.campaigns.forEach(campaign => {
        console.log(`  - ID: ${campaign.id}, Название: ${campaign.domain || campaign.business || 'N/A'}`);
      });
      console.log('\n💡 Добавьте один из этих ID в .env как YANDEX_CAMPAIGN_ID');
    }
  } catch (err) {
    console.error('❌ Ошибка при получении кампаний:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

getCampaigns();
