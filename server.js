const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const TG_TOKEN = "8588432224:AAE8eQA5xDJiWktiQnhDm0iYzuEd3yZk9s8";

const app = express();
app.use(bodyParser.json());

app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text || "";

    // Логіка відповіді консультанта
    let responseText = "";

    const lowerText = text.toLowerCase();

    if (lowerText.includes("ні") || lowerText.includes("не хочу")) {
      responseText = "Розумію 😅 Тоді можу розказати про ціни та напрямки курсів: Roblox, Procreate, 3D, AI. Вартість 2400–3200 грн/місяць. Телефон для запису: 093 021 27 47 📞";
    } else if (lowerText.includes("хочу записатися")) {
      responseText = "Супер! Зателефонуйте нам для запису: 093 021 27 47 📞";
    } else {
      responseText = "Я — ваш інтелектуальний онлайн-консультант IT-Kitchen 👨‍🍳💻✨. Ми навчаємо дітей від 7 років, підлітків і дорослих. Напрямки: 🎮 Roblox/Minecraft, 🎨 Procreate, 🧊 3D (Blender/Tinkercad), ⚙️ Програмування/AI. Вартість: 2400–3200 грн/місяць. Пишіть, якщо хочете тест чи консультацію!";
    }

    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: responseText,
      parse_mode: "Markdown"
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
