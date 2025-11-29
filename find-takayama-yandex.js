// find-takayama-yandex.js - Поиск Takayama в Яндексе
require('dotenv').config();
const axios = require('axios');

const { YANDEX_TOKEN, YANDEX_CAMPAIGN_ID } = process.env;

async function findTakayama() {
  try {
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offers`;
    
    console.log('Поиск товаров Takayama...\n');
    
    let found = [];
    let pageToken = '';
    let pageNum = 0;
    
    while (pageNum < 20) {
      const res = await axios.post(url, {
        limit: 200,
        page_token: pageToken || undefined
      }, {
        headers: {
          'Authorization': `Bearer ${YANDEX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const offers = res.data.result?.offers || [];
      pageNum++;
      
      // Ищем Takayama
      const matches = offers.filter(o => {
        const offerId = o.shopSku || o.offerId;
        const name = o.name || '';
        return offerId?.includes('Takayama') || name.includes('Takayama');
      });
      
      found = found.concat(matches);
      
      pageToken = res.data.result?.paging?.nextPageToken || '';
      if (!pageToken) break;
    }
    
    console.log(`✅ Найдено товаров Takayama: ${found.length}\n`);
    
    found.forEach((offer, i) => {
      console.log(`${i + 1}. offerId/shopSku: ${offer.shopSku || offer.offerId}`);
      console.log(`   name: ${offer.name}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

findTakayama();
