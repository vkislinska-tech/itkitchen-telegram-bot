// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fetch = require('node-fetch'); // для запитів до Telegram та Gemini

const app = express();
app.use(bodyParser.json());

// ================== Налаштування ==================
const TG_TOKEN = '8588432224:AAE8eQA5xDJiWktiQnhDm0iYzuEd3yZk9s8';
const GEMINI_KEY = 'AIzaSyDW_BqFUXOxRjwfmyzm5TqSR3ZHyXDJamw';
const SHEET_ID = '1Y57JuWh7QFrJdjHQNxkmOuHK_d-ZN3UyV8Cw-EdWQx0';

// Зчитуємо ключ з Environment Variable
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const client_email = creds.client_email;
const private_key = creds.private_key.replace(/\\n/g, '\n'); // заміна \n

const auth = new google.auth.JWT(
  client_email,
  null,
  private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

// ================== Основний роут ==================
app.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.message) return res.sendStatus(200);

    const chatId = data.message.chat.id;
    const userText = data.message.text || "";
    const userName = data.message.from.first_name || "Клієнт";

    // ================== Читання історії з Google Sheets ==================
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A:C', // стовпчик A: chatId, B: history, C: last update
    });

    const dataRange = sheetRes.data.values || [];
    let history = "";
    let rowIndex = -1;

    for (let i = 0; i < dataRange.length; i++) {
      if (dataRange[i][0] == chatId) {
        history = dataRange[i][1] || "";
        rowIndex = i;
        break;
      }
    }

    // ================== Формування відповіді ==================
    const systemPrompt = `Ти — інтелектуальний онлайн-консультант школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка, пр-т Героїв Небесної Сотні, 18/4). Ти працюєш на платному тарифі, школа незабаром відкривається! 🚀
Вартість навчання:
• Ціна: 2400-3200 грн/місяць
• Точна вартість залежить від курсу, інтенсивності та кількості годин на тиждень. 💰
База знань:
• Геймдизайн (Roblox/Minecraft) 🎮
• Цифровий малюнок (Procreate) 🎨
• 3D-моделювання (Blender/Tinkercad) 🧊
• Креатив ⚙️📱🤖
Логіка тесту (СУВОРО):
1. Пропозиція тесту, якщо клієнт вагається
2. Відмова — якщо 'ні' або 'не хочу', не пропонуй тест
3. Якщо 'Ні' або 'Хочу записатися', одразу відповідай про курси/ціни та номер 0930212747
4. Став питання тесту по черзі (1,2,3), не повторюй тест
Питання тесту:
1. Дитині більше подобається створювати руками (як 3D-фігурки), грати чи малювати? 🤔
2. Це був би світ пригод, професійна картина чи мультфільм? 🌟
3. Цікавіше розбиратися в програмах чи створювати гарний візуал? ⚙️🎨
Фінальний аналіз:
1. Дякую! Вже аналізую ваші відповіді... 🧠✨
2. Рекомендую 1-2 курси та згадати ціни 2400-3200 грн
3. Завершити закликом: Зателефонуйте нам: 093 021 27 47 📞
Стиль: дружній, 2-3 речення, багато емодзі.`;

    const fullPrompt = `${systemPrompt}\n\nІсторія діалогу:\n${history}\nКлієнт (${userName}): ${userText}\nБот:`;

    const botResponse = await callGemini(fullPrompt);

    // ================== Оновлення історії ==================
    const newHistory = `${history}\nКлієнт: ${userText}\nБот: ${botResponse}`.slice(-3500);

    if (rowIndex >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `B${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newHistory]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'A:C',
        valueInputOption: 'RAW',
        requestBody: { values: [[chatId, newHistory, new Date().toISOString()]] },
      });
    }

    // ================== Відправка відповіді в Telegram ==================
    await sendText(chatId, botResponse);

    res.sendStatus(200);
  } catch (err) {
    console.error("Помилка:", err);
    res.sendStatus(200);
  }
});

// ================== Функція виклику Gemini ==================
async function callGemini(fullPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();

  if (json.candidates && json.candidates[0] && json.candidates[0].content) {
    return json.candidates[0].content.parts[0].text;
  } else {
    console.error("Помилка Gemini API:", json);
    return "Вибачте, сталася технічна заминка. Спробуйте через хвилину!";
  }
}

// ================== Функція відправки Telegram ==================
async function sendText(chatId, text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

// ================== Запуск сервера ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
