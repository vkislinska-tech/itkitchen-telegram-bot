const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const ADMIN_ID = process.env.ADMIN_ID; 
const PORT = process.env.PORT || 3000;

const sessions = {};

const SYSTEM_PROMPT = `
Ти — проактивний ментор школи «IT-кухня» 👨‍🍳💻.
ТВОЄ ГОЛОВНЕ ПРАВИЛО: Відповідай ДУЖЕ ЛАКОНІЧНО (максимум 3-4 речення). 🛑

ЛОГІКА:
1. Дай коротку відповідь на питання (у чому користь). 
2. Наприкінці додай одне запитання-гачок, щоб продовжити бесіду.
3. Лише коли клієнт розпитав про курси, запропонуй дзвінок: "Хочете, наш адмін Вікторія зателефонує вам, щоб підібрати час для пробного?"
4. Якщо згодні — пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером. ✨"

Стиль: Натхненний, дружній, емодзі ✨🎨. Не пиши дату.
`;

app.get('/alive', (req, res) => res.send('Server is alive ✅'));

app.post('/', async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.sendStatus(200);

        const chatId = message.chat.id;

        // --- 1. ПЕРЕХОПЛЕННЯ НОМЕРА ТА КОНТЕКСТУ ---
        if (message.contact && ADMIN_ID) {
            const phone = message.contact.phone_number;
            const firstName = message.contact.first_name;
            const chatLink = `tg://user?id=${message.from.id}`;
            
            let contextSummary = "Цікавились навчанням";
            if (sessions[chatId]) {
                contextSummary = sessions[chatId]
                    .filter(msg => msg.role === "user" && !msg.parts[0].text.includes(SYSTEM_PROMPT))
                    .map(msg => msg.parts[0].text)
                    .slice(-3).join(" | ");
            }

            const adminMsg = `🚀 ЗАЯВКА!\n👤 ${firstName}\n📱 ${phone}\n🔍 ПИТАЛИ: ${contextSummary}\n💬 [ЧАТ](${chatLink})`;

            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_ID, text: adminMsg, parse_mode: 'Markdown' })
            });

            return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Дякуємо! Вікторія вже отримала ваш запит і скоро зателефонує. До зустрічі! ✨",
                    reply_markup: { remove_keyboard: true }
                })
            });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text.trim();

        // --- 2. ПРИВІТАННЯ ТА ПАМ'ЯТЬ ---
        if (userText.toLowerCase() === '/start') {
            delete sessions[chatId];
            return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Тут діти створюють власні IT-світи. Чим цікавиться ваша дитина: малюванням чи створенням ігор? 🎨🎮"
                })
            });
        }

        if (!sessions[chatId]) {
            sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        }
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        // Обмежуємо пам'ять (останні 6 реплік)
        if (sessions[chatId].length > 8) sessions[chatId].splice(1, 1);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

        // --- 3. ВІДПРАВКА ---
        const payload = { chat_id: chatId, text: replyText };

        if (replyText.includes("Натисніть кнопку нижче")) {
            payload.reply_markup = {
                keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]],
                one_time_keyboard: true,
                resize_keyboard: true
            };
        }

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

    } catch (e) { console.error(e); }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Compact Mentor Bot is Live!`));
