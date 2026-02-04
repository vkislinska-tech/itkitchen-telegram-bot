const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");

const TG_TOKEN = "8588432224:AAE8eQA5xDJiWktiQnhDm0iYzuEd3yZk9s8";
const SHEET_ID = "1Y57JuWh7QFrJdjHQNxkmOuHK_d-ZN3UyV8Cw-EdWQx0";

// Шлях до Service Account JSON (ми його додаємо у Render як Environment variable)
const GOOGLE_CREDS_JSON = process.env.GOOGLE_CREDS_JSON;

const app = express();
app.use(bodyParser.json());

// Функція відправки повідомлення в Telegram
async function sendText(chatId, text) {
  await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  });
}

// Функція роботи з Google Sheets
async function updateHistory(chatId, userText, botResponse) {
  const creds = JSON.parse(GOOGLE_CREDS_JSON);
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];
  await sheet.loadCells();

  // Шукаємо рядок з chatId
  const rows = await sheet.getRows();
  let row = rows.find(r => r.ID == chatId);
  const newHistory = `${userText}\n${botResponse}`;

  if (row) {
    row.History = (row.History || "") + "\n" + newHistory;
    row.LastUpdate = new Date();
    await row.save();
  } else {
    await sheet.addRow({
      ID: chatId,
      History: newHistory,
      LastUpdate: new Date()
    });
  }
}

// Основний POST ендпоінт для Telegram
app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const userText = message.text || "";

    // Логіка відповіді (з твоєї бази консультанта)
    let botResponse = "";

    const lowerText = userText.toLowerCase();
    if (lowerText.includes("ні") || lowerText.includes("не хочу")) {
      botResponse = "Розумію 😅 Тоді можу розказати про ціни та напрямки курсів: Roblox, Procreate, 3D, AI. Вартість 2400–3200 грн. Телефон для запису: 093 021 27 47 📞";
    } else if (lowerText.includes("хочу записатися")) {
      botResponse = "Супер! Зателефонуйте нам для запису: 093 021 27 47 📞";
    } else {
      botResponse = "Я — ваш інтелектуальний онлайн-консультант IT-Kitchen 👨‍🍳💻✨. Ми навчаємо дітей від 7 років, підлітків і дорослих. Напрямки: 🎮 Roblox/Minecraft, 🎨 Procreate, 🧊 3D (Blender/Tinkercad), ⚙️ Програмування/AI. Вартість: 2400–3200 грн/місяць. Пишіть, якщо хочете тест чи консультацію!";
    }

    // Оновлюємо історію в Google Sheets
    await updateHistory(chatId, userText, botResponse);

    // Відправляємо відповідь
    await sendText(chatId, botResponse);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Старт сервера на Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// ================== Запуск сервера ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
