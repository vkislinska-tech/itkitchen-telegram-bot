const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3000;

app.get('/alive', (req, res) => res.send('Server is alive ✅'));

app.post('/', async (req, res) => {
    try {
        const message = req.body.message;
        // Якщо це не текст, ігноруємо
        if (!message || !message.text) return res.sendStatus(200);

        const chatId = message.chat.id;
        let replyText = "";

        // Перевірка наявності ключа
        if (!GEMINI_KEY) {
            replyText = "❌ ПОМИЛКА: Render не бачить GEMINI_KEY. Перевір Environment Variables.";
        } else {
            // Пробуємо найпростіший запит до Gemini
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: "Just say Hello" }]
                        }]
                    })
                });

                const data = await response.json();

                // АНАЛІЗ ВІДПОВІДІ
                if (data.candidates && data.candidates[0].content) {
                    replyText = "✅ УСПІХ! AI працює! Він відповів: " + data.candidates[0].content.parts[0].text;
                } 
                else if (data.error) {
                    // Ось це нам треба! Виводимо код помилки
                    replyText = `❌ ПОМИЛКА GOOGLE:
Code: ${data.error.code}
Status: ${data.error.status}
Message: ${data.error.message}`;
                } 
                else {
                    replyText = "⚠️ Дивна відповідь (перешли це розробнику): " + JSON.stringify(data);
                }

            } catch (apiError) {
                replyText = "❌ Збій запиту (fetch error): " + apiError.message;
            }
        }

        // Відправка звіту в Telegram
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: replyText
            })
        });

    } catch (e) {
        console.error(e);
    }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Diagnostic Server running on ${PORT}`));
