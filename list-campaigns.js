// list-campaigns.js - Список всех кампаний в Business
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_BUSINESS_ID } = process.env;

async function listCampaigns() {
  try {
    const url = `https://api.partner.market.yandex.ru/campaigns`;
    
    console.log(`Получение списка кампаний для Business ID ${YANDEX_BUSINESS_ID}...\n`);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const campaigns = res.data.campaigns || [];
    
    console.log(`✅ Найдено кампаний: ${campaigns.length}\n`);
    
    campaigns.forEach((campaign, i) => {
      console.log(`${i + 1}. Campaign ID: ${campaign.id}`);
      console.log(`   Domain: ${campaign.domain || 'N/A'}`);
      console.log(`   Business: ${campaign.business?.name || 'N/A'} (ID: ${campaign.business?.id || 'N/A'})`);
      console.log(`   Placement Type: ${campaign.placementType || 'N/A'}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

listCampaigns();
