const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Дозволяємо Express обробляти JSON (потрібно для Telegram Webhook)
app.use(express.json());

// Змінні оточення
const TG_TOKEN = process.env.TG_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3000;

// 1. Маршрут для перевірки життя сервера (Health Check)
app.get('/alive', (req, res) => {
    res.send('Server is alive ✅');
});

// 2. Головний маршрут для Webhook (сюди Telegram шле повідомлення)
app.post('/', async (req, res) => {
    try {
        // Логування вхідного запиту (для налагодження)
        console.log('Incoming update:', JSON.stringify(req.body, null, 2));

        const message = req.body.message;

        // Ігноруємо оновлення без тексту (наприклад, стікери без тексту або редагування)
        if (!message || !message.text) {
            return res.sendStatus(200);
        }

        const chatId = message.chat.id;
        const userText = message.text.trim(); // Прибираємо зайві пробіли
        const lowerText = userText.toLowerCase();
        
        let replyText = "";

        // --- ЛОГІКА ШКОЛИ IT KITCHEN ---

        if (lowerText.includes("розклад")) {
            replyText = "Ось розклад школи: Пн-Пт 08:00–15:00";
        } 
        else if (lowerText.includes("контакти")) {
            replyText = "Контакти школи: +380 XX XXX XXXX, school@example.com";
        } 
        else if (lowerText.includes("привіт")) {
            replyText = "Привіт! Я бот IT Kitchen 🧑‍🍳";
        } 
        // --- ІНТЕГРАЦІЯ З GEMINI (AI) ---
        else {
            if (GEMINI_KEY) {
                try {
                    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{ 
                                    text: `Ти асистент школи "IT Kitchen" (креативна IT школа для дітей). Твій стиль: лаконічний, творчий, доброзичливий. Користувач питає: "${userText}"` 
                                }]
                            }]
                        })
                    });

                    const data = await geminiResponse.json();
                    
                    // Перевіряємо, чи є відповідь від AI
                    if (data.candidates && data.candidates[0].content) {
                        replyText = data.candidates[0].content.parts[0].text;
                    } else {
                        replyText = "Вибач, я зараз трохи замислився. Спробуй ще раз пізніше.";
                        console.error('Gemini error structure:', JSON.stringify(data));
                    }
                } catch (error) {
                    console.error('Gemini connection error:', error);
                    replyText = "Тимчасова помилка зв'язку з AI мозком 🧠";
                }
            } else {
                // Якщо немає ключа Gemini, просто ехо
                replyText = `Привіт! Ти написав: ${userText}`;
            }
        }

        // --- ВІДПРАВКА ВІДПОВІДІ В TELEGRAM ---
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: replyText
            })
        });

    } catch (err) {
        console.error('Error processing request:', err);
    }

    // Завжди відповідаємо 200 OK Телеграму, інакше він буде слати повтори
    res.sendStatus(200);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
