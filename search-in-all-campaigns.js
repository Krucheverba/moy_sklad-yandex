// search-in-all-campaigns.js - Поиск товара во всех кампаниях
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN } = process.env;
const SEARCH_SKU = 'Takayama-Adaptec-5w-40-4L';
const CAMPAIGNS = [114631219, 128441417, 141504862];

async function searchInCampaign(campaignId) {
  try {
    const url = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers`;
    
    let found = null;
    let pageToken = '';
    let pageNum = 0;
    const MAX_PAGES = 10;
    
    while (pageNum < MAX_PAGES && !found) {
      const requestBody = { 
        limit: 200,
        page_token: pageToken || undefined
      };

      const res = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${YANDEX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = res.data;
      const offers = data.result?.offers || [];
      
      pageNum++;
      
      // Ищем товар
      found = offers.find(offer => {
        const offerId = offer.shopSku || offer.offerId;
        return offerId === SEARCH_SKU || offerId?.includes('Takayama');
      });
      
      if (found) break;
      
      pageToken = data.result?.paging?.nextPageToken || '';
      if (!pageToken) break;
    }
    
    return found;

  } catch (err) {
    console.error(`  ❌ Ошибка для Campaign ${campaignId}:`, err.message);
    return null;
  }
}

async function searchInAllCampaigns() {
  console.log(`Поиск товара "${SEARCH_SKU}" во всех кампаниях...\n`);
  
  for (const campaignId of CAMPAIGNS) {
    console.log(`Проверка Campaign ${campaignId}...`);
    const found = await searchInCampaign(campaignId);
    
    if (found) {
      console.log(`  ✅ НАЙДЕН!`);
      console.log(`  offerId/shopSku: ${found.shopSku || found.offerId}`);
      console.log(`  name: ${found.name}`);
      console.log('');
    } else {
      console.log(`  ❌ Не найден`);
      console.log('');
    }
  }
}

searchInAllCampaigns();
