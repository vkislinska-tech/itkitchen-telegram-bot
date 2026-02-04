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
Ти — проактивний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка).
Твоя місія: надихати батьків на навчання дітей. Пояснюй користь IT (логіка, креатив).

ПРАВИЛА:
1. Відповідай коротко (до 3 речень).
2. Якщо клієнт зацікавився, запитай: "Хочете, наш адміністратор Вікторія зателефонує вам, щоб все розповісти та підібрати час?"
3. Якщо клієнт згоден, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"
`;

app.get('/alive', (req, res) => res.send('Server is alive ✅'));

app.post('/', async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.sendStatus(200);

        const chatId = message.chat.id;

        // --- 1. ПЕРЕХОПЛЕННЯ НОМЕРА ТА ІСТОРІЇ РОЗМОВИ ---
        if (message.contact && ADMIN_ID) {
            const phone = message.contact.phone_number;
            const firstName = message.contact.first_name;
            const chatLink = `tg://user?id=${message.from.id}`;
            
            // Збираємо контекст: про що питав клієнт (останні 3-4 повідомлення)
            let contextSummary = "Немає даних";
            if (sessions[chatId]) {
                contextSummary = sessions[chatId]
                    .filter(msg => msg.role === "user" && !msg.parts[0].text.includes(SYSTEM_PROMPT))
                    .map(msg => `• ${msg.parts[0].text}`)
                    .slice(-3) // Беремо останні 3 питання клієнта
                    .join("\n");
            }

            const adminMessage = `🚀 НОВА ЗАЯВКА!\n\n👤 Ім'я: ${firstName}\n📱 Тел: ${phone}\n\n🔍 ЧИМ ЦІКАВИЛИСЬ:\n${contextSummary}\n\n💬 [НАПИСАТИ В ТЕЛЕГРАМ](${chatLink})`;

            // Сповіщення Вікторії
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: adminMessage,
                    parse_mode: 'Markdown'
                })
            });

            return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Дякуємо! Отримали ваш контакт. Вікторія зателефонує вам найближчим часом! ✨",
                    reply_markup: { remove_keyboard: true }
                })
            });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text.trim();

        // --- 2. ПАМ'ЯТЬ ТА AI ---
        if (!sessions[chatId]) {
            sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        }
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        if (sessions[chatId].length > 10) sessions[chatId].splice(1, 1);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

        // --- 3. ВІДПРАВКА ВІДПОВІДІ З КНОПКОЮ ---
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

app.listen(PORT, () => console.log(`Smart Admin Bot is Live!`));
