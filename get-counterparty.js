// get-counterparty.js - Получить контрагентов из МойСклад
require('dotenv').config();
const axios = require('axios');

const base = process.env.MOYSKLAD_BASE;
const token = process.env.MOYSKLAD_PASSWORD;

async function getCounterparties() {
  try {
    const url = `${base}/entity/counterparty?limit=10`;
    console.log('Получение контрагентов из МойСклад...');
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json;charset=utf-8'
      }
    });

    console.log(`\n✅ Найдено контрагентов: ${res.data.rows.length}\n`);
    
    res.data.rows.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name}`);
      console.log(`   ID: ${agent.id}`);
      console.log('');
    });

    // Создадим контрагента "Яндекс.Маркет" если его нет
    const yandexAgent = res.data.rows.find(a => a.name.includes('Яндекс') || a.name.includes('Yandex'));
    
    if (yandexAgent) {
      console.log(`✅ Найден контрагент для Яндекс: ${yandexAgent.name}`);
      console.log(`   ID: ${yandexAgent.id}`);
      return yandexAgent.id;
    } else {
      console.log('⚠️ Контрагент "Яндекс.Маркет" не найден. Создаем...');
      return await createYandexCounterparty();
    }
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

async function createYandexCounterparty() {
  try {
    const url = `${base}/entity/counterparty`;
    const body = {
      name: 'Яндекс.Маркет (FBS)',
      companyType: 'legal'
    };
    
    const res = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json;charset=utf-8',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Создан контрагент: ${res.data.name}`);
    console.log(`   ID: ${res.data.id}`);
    return res.data.id;
  } catch (err) {
    console.error('❌ Ошибка создания контрагента:', err.message);
    throw err;
  }
}

getCounterparties().then(agentId => {
  if (agentId) {
    console.log(`\n💡 Добавьте в .env:\nDEFAULT_AGENT_ID=${agentId}`);
  }
});
