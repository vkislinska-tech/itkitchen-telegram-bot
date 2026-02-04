// server.js
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const TG_TOKEN = '8588432224:AAE8eQA5xDJiWktiQnhDm0iYzuEd3yZk9s8';

app.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.message) return res.sendStatus(200);

    const chatId = data.message.chat.id;
    const userName = data.message.from.first_name || "Клієнт";

    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `Привіт, ${userName}! Бот працює.` })
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
