const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `
Ти — інтелектуальний консультант «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка, пр-т Героїв Небесної Сотні, 18/4).
Вартість навчання: 2400-3200 грн на місяць. 💰
Напрямки: Геймдизайн (Roblox/Minecraft) 🎮, Procreate 🎨, 3D-моделювання 🧊, AI ⚙️.

Логіка тесту (СУВОРО):
1. Якщо клієнт вагається — запропонуй тест із 3 запитань (став по одному!). ✨
2. Якщо клієнт хоче записатися — давай номер 093 021 27 47 📞.
Стиль: Дружній, 2-3 речення, емодзі. Не пиши дату.
`;

app.get('/alive', (req, res) => res.send('Server is alive ✅'));

app.post('/', async (req, res) => {
    try {
        const message = req.body.message;
        if (!message || !message.text) return res.sendStatus(200);

        const chatId = message.chat.id;
        const userText = message.text.trim();
        let replyText = "";

        if (userText === '/start') {
            replyText = "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Чим цікавиться ваша дитина? 🤖🎨";
        } else {
            try {
                // ВИКОРИСТОВУЄМО СТАБІЛЬНУ ВЕРСІЮ v1 ТА МОДЕЛЬ 1.5 FLASH
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\nКлієнт: ${userText}` }] }]
                    })
                });

                const data = await response.json();

                if (data.candidates && data.candidates[0].content) {
                    replyText = data.candidates[0].content.parts[0].text;
                } else if (data.error && data.error.code === 429) {
                    replyText = "Зараз у нас багато гостей! 👨‍🍳 Зачекайте 30 секунд або наберіть нас: 093 021 27 47 📞";
                } else {
                    replyText = "Замислився трішки... Напишіть ще раз за мить! 🤔";
                }
            } catch (err) {
                replyText = "Технічна заминка. Ми вже лагодимо! 📞 093 021 27 47";
            }
        }

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: replyText })
        });

    } catch (e) { console.error(e); }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Stable 1.5 Flash Bot running on ${PORT}`));
