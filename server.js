const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const ADMIN_ID = process.env.ADMIN_ID; 
const PORT = process.env.PORT || 3000;

// Тимчасова пам'ять для контексту
const sessions = {};

const SYSTEM_PROMPT = `
Ти — проактивний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка, пр-т Героїв Небесної Сотні, 18/4).
Твоя місія: надихати. Пояснюй користь програмування (логіка), 3D (простір) та дизайну (креатив).

ТВОЯ СТРАТЕГІЯ ПРОДАЖУ:
1. Якщо клієнт зацікавлений, запитай: "Хочете, наш адміністратор зателефонує вам, щоб відповісти на всі питання та підібрати зручний час для знайомства зі школою?"
2. Якщо клієнт каже "Так" або "Давайте" — ТВОЯ ВІДПОВІДЬ МАЄ БУТИ ТАКОЮ (СУВОРО): 
   "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами найближчим часом. ✨"
3. Більше нічого не пиши в цій відповіді, тільки цю фразу.
`;

app.get('/alive', (req, res) => res.send('Server is alive ✅'));

app.post('/', async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.sendStatus(200);

        const chatId = message.chat.id;

        // --- 1. ОБРОБКА КОНТАКТУ (Коли клієнт натиснув кнопку) ---
        if (message.contact && ADMIN_ID) {
            const phone = message.contact.phone_number;
            const firstName = message.contact.first_name;
            const userId = message.from.id;
            const username = message.from.username ? `@${message.from.username}` : "Прихований";
            
            // Формуємо посилання на чат
            const chatLink = `tg://user?id=${userId}`;

            const adminMessage = `🚀 НОВА ЗАЯВКА!\n\n👤 Ім'я: ${firstName}\n📱 Тел: ${phone}\n🔗 Юзернейм: ${username}\n\n💬 Написати клієнту: [ПЕРЕЙТИ В ЧАТ](${chatLink})`;

            // Сповіщення вам
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: adminMessage,
                    parse_mode: 'Markdown'
                })
            });

            // Дякуємо клієнту
            return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Дякуємо! Вікторія отримала ваш контакт і зателефонує вам зовсім скоро. До зустрічі в IT Kitchen! ✨",
                    reply_markup: { remove_keyboard: true }
                })
            });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text.trim();

        // --- 2. ПАМ'ЯТЬ ТА AI (Gemini 2.0 Flash) ---
        if (!sessions[chatId]) {
            sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        }
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        // Тримаємо контекст 10 реплік
        if (sessions[chatId].length > 12) sessions[chatId].splice(1, 1);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

        // --- 3. ВІДПРАВКА ВІДПОВІДІ (З кнопкою, якщо це заклик до дії) ---
        const payload = {
            chat_id: chatId,
            text: replyText
        };

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

app.listen(PORT, () => console.log(`Smart Sales Bot is Live on ${PORT}`));
