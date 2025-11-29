// setup-webhook.js - Настройка webhook в Яндекс.Маркете
require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.YANDEX_TOKEN;
const CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;

// ВАЖНО: Замените на ваш реальный URL после запуска ngrok
const WEBHOOK_URL = 'https://your-ngrok-url.ngrok.io/webhook';

async function setupWebhook() {
  console.log('=== Настройка Webhook в Яндекс.Маркете ===\n');
  console.log(`Campaign ID: ${CAMPAIGN_ID}`);
  console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

  if (WEBHOOK_URL.includes('your-ngrok-url')) {
    console.error('❌ ОШИБКА: Замените "your-ngrok-url" на реальный URL от ngrok!');
    console.error('   1. Запустите: ngrok http 3000');
    console.error('   2. Скопируйте URL из ngrok (например: https://abc123.ngrok.io)');
    console.error('   3. Замените WEBHOOK_URL в этом файле');
    process.exit(1);
  }

  try {
    // Пробуем настроить webhook через Partner API
    const url = `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/settings/webhook`;
    
    console.log('📝 Отправка запроса на настройку webhook...');
    
    const response = await axios.put(url, {
      url: WEBHOOK_URL,
      events: [
        'ORDER_CREATED',
        'ORDER_STATUS_UPDATED'
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('✅ Webhook успешно настроен!');
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
    
  } catch (err) {
    console.error('❌ Ошибка при настройке webhook:');
    console.error(`Статус: ${err.response?.status}`);
    console.error(`Сообщение: ${err.response?.data?.message || err.message}`);
    
    if (err.response?.data) {
      console.error('Детали:', JSON.stringify(err.response.data, null, 2));
    }

    console.log('\n💡 Возможные причины:');
    console.log('1. Webhook настраивается не через API, а через личный кабинет');
    console.log('2. Нужны дополнительные права для токена');
    console.log('3. Для FBS/DBS модели webhook настраивается по-другому');
    console.log('\n📧 Рекомендация: Обратитесь в поддержку Яндекс.Маркета');
  }
}

setupWebhook();
