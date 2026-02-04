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
Ти — ментор школи «IT-кухня» 👨‍🍳💻.
ТВОЯ ЗАДАЧА: Спочатку надихнути та розповісти про курси, а лише ПІСЛЯ ЦЬОГО пропонувати дзвінок.

ЛОГІКА СПІЛКУВАННЯ:
1. На старті: Просто вітайся і запитуй, що цікавить (малювання, ігри чи 3D).
2. В процесі: Розповідай про користь (логіка, креатив, майбутнє).
3. ПУНКТ "ДЗВІНОК" (Тільки в кінці розмови): 
   - Коли клієнт отримав відповідь на своє питання, запитай: "До речі, хочете, наш адмін Вікторія зателефонує вам, щоб підібрати зручний час для пробного заняття?"
4. Якщо клієнт згоден, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"
`;

app.get('/alive', (req, res) => res.send('Server is alive ✅'));

app.post('/', async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.sendStatus(200);

        const chatId = message.chat.id;

        // --- 1. ПЕРЕХОПЛЕННЯ НОМЕРА (Lead Generation) ---
        if (message.contact && ADMIN_ID) {
            const phone = message.contact.phone_number;
            const firstName = message.contact.first_name;
            const chatLink = `tg://user?id=${message.from.id}`;
            
            let contextSummary = "Цікавились навчанням";
            if (sessions[chatId]) {
                contextSummary = sessions[chatId]
                    .filter(msg => msg.role === "user" && !msg.parts[0].text.includes(SYSTEM_PROMPT))
                    .map(msg => `• ${msg.parts[0].text}`)
                    .slice(-3).join("\n");
            }

            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: `🚀 ЗАЯВКА!\n👤 ${firstName}\n📱 ${phone}\n🔍 КОНТЕКСТ:\n${contextSummary}\n\n💬 [ЧАТ](${chatLink})`,
                    parse_mode: 'Markdown'
                })
            });

            return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Дякую! Вікторія отримала ваш номер і зателефонує вам найближчим часом. До зустрічі в IT Kitchen! ✨",
                    reply_markup: { remove_keyboard: true }
                })
            });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text.trim();

        // --- 2. ПАМ'ЯТЬ ТА AI ---
        if (userText.toLowerCase() === '/start') {
            delete sessions[chatId]; // Скидаємо стару розмову при старті
            return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Тут ми готуємо майбутнє власними руками. Чим цікавиться ваша дитина? Можливо, вона обожнює ігри чи малювання? 🤖🎨"
                })
            });
        }

        if (!sessions[chatId]) {
            sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        }
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

        // --- 3. ВІДПРАВКА ВІДПОВІДІ ---
        const payload = { chat_id: chatId, text: replyText };

        if (replyText.includes("Натисніть кнопку нижче")) {
            payload.reply_markup = {
                keyboard: [[{ text: "📱 Поділитися моїм номером", request_contact: true }]],
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

app.listen(PORT, () => console.log(`Smart Logic Bot is Live!`));
