// poll-orders-loop.js - Автоматический опрос заказов каждые 5 минут
require('dotenv').config();
const { exec } = require('child_process');

const INTERVAL_MS = 5 * 60 * 1000; // 5 минут

console.log('🔄 Запуск автоматического опроса заказов');
console.log(`⏱️  Интервал: каждые 5 минут\n`);

function runPoll() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`⏰ ${new Date().toLocaleString('ru-RU')}`);
  console.log('='.repeat(70));
  
  exec('node poll-orders.js', (error, stdout, stderr) => {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    if (error) console.error('Ошибка:', error.message);
  });
}

// Первый запуск сразу
runPoll();

// Затем каждые 5 минут
setInterval(runPoll, INTERVAL_MS);

console.log('✅ Polling запущен. Нажмите Ctrl+C для остановки.\n');
