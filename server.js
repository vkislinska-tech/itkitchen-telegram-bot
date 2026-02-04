const express = require("express");
const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const app = express();
app.use(express.json());

// ====== Вставте свої дані ======
const TG_TOKEN = "8588432224:AAE8eQA5xDJiWktiQnhDm0iYzuEd3yZk9s8";
const SHEET_ID = "1Y57JuWh7QFrJdjHQNxkmOuHK_d-ZN3UyV8Cw-EdWQx0";
const creds = require("./service-account.json"); // Ваш JSON ключ Google
// ================================

// Питання тесту
const testQuestions = [
  "Дитині більше подобається створювати руками (як 3D-фігурки), грати чи малювати? 🤔",
  "Це був би світ пригод, професійна картина чи мультфільм? 🌟",
  "Цікавіше розбиратися в програмах чи створювати гарний візуал? ⚙️🎨"
];

// Просте збереження стану користувача (тимчасово)
const userStates = {};

app.post("/", async (req, res) => {
  const message = req.body.message;
  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;
  const userText = message.text || "";
  const userName = message.from.first_name || "Клієнт";

  // Підключення до Google Sheets
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  try {
    // Перевіряємо стан користувача
    let state = userStates[chatId] || { step: 0, answers: [] };

    // Якщо користувач сказав "ні" або "не хочу" – не пропонуємо тест
    if (/^ні$|^не хочу$/i.test(userText)) {
      const response = "Добре! Якщо хочете дізнатися ціни або курси, телефонуйте: 093 021 27 47 📞";
      await sendText(chatId, response);
      await addToSheet(sheet, chatId, userText, response);
      userStates[chatId] = { step: 0, answers: [] }; // скидаємо стан
      return res.sendStatus(200);
    }

    // Якщо тест ще не завершено
    if (state.step < testQuestions.length) {
      // Якщо це не перше повідомлення – зберігаємо відповідь попереднього запитання
      if (state.step > 0) {
        state.answers.push(userText);
      }

      const question = testQuestions[state.step];
      await sendText(chatId, question);
      state.step += 1;
      userStates[chatId] = state;
      return res.sendStatus(200);
    }

    // Після 3-го питання – аналіз і рекомендація курсів
    state.answers.push(userText);
    const analysis = `Дякую! Вже аналізую ваші відповіді... 🧠✨\n` +
      `Рекомендую курси: ` +
      `• Геймдизайн (Roblox/Minecraft) 🎮 або ` +
      `• Цифровий малюнок (Procreate) 🎨\n` +
      `Ціна: від 2400 до 3200 грн на місяць.\n` +
      `Зателефонуйте нам для запису: 093 021 27 47 📞`;

    await sendText(chatId, analysis);
    await addToSheet(sheet, chatId, userText, analysis);

    userStates[chatId] = { step: 0, answers: [] }; // скидаємо стан
    return res.sendStatus(200);

  } catch (err) {
    console.error(err);
    const response = "Вибачте, зараз технічні проблеми. Спробуйте через хвилину або телефонуйте 093 021 27 47 📞";
    await sendText(chatId, response);
    return res.sendStatus(200);
  }
});

// ====== Функції ======
async function sendText(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    })
  });
}

async function addToSheet(sheet, chatId, userText, botResponse) {
  await sheet.addRow({
    chatId: chatId,
    user: userText,
    bot: botResponse,
    date: new Date()
  });
}

// ====== Запуск сервера ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Бот запущений на порту ${PORT}`));
