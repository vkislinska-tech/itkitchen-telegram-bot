const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

const SYSTEM_PROMPT = `
Ти — інтелектуальний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка).
Твоя мета: закохати батьків у світ технологій через логіку та креатив.

ПРАВИЛА ТЕРПІННЯ (СУВОРО):
1. ПЕРШІ 4 ПОВІДОМЛЕННЯ: Тільки відповідай на питання про курси. Розповідай, як малювання розвиває візуал, а ігри — логіку. ❌ НЕ пропонуй дзвінок адміна.
2. ПІСЛЯ 4-5 ПОВІДОМЛЕНЬ: Якщо клієнт продовжує розмову, ввічливо запитай: "Хочете, наш адмін Вікторія зателефонує вам, щоб підібрати час для знайомства зі школою?"
3. ЯКЩО ЗГОДНІ: Пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"

СТИЛЬ: Натхненний, лаконічний (до 4 речень). Емодзі ✨🎨. Не пиши дату.
`;

app.get('/alive', (req, res) => res.send('Kitchen is warming up! 👨‍🍳'));

app.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.sendStatus(200);
        const chatId = message.chat.id;

        // --- 1. ОБРОБКА КОНТАКТУ ---
        if (message.contact && ADMIN_ID) {
            const chatLink = `tg://user?id=${message.from.id}`;
            let context = "Цікавились навчанням";
            if (sessions[chatId]) {
                context = sessions[chatId]
                    .filter(msg => msg.role === "user" && !msg.parts[0].text.includes("Ти —"))
                    .map(msg => msg.parts[0].text).slice(-3).join(" | ");
            }

            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: `🚀 ЗАЯВКА!\n👤 ${message.contact.first_name}\n📱 ${message.contact.phone_number}\n🔍 ПИТАЛИ: ${context}\n💬 [ЧАТ](${chatLink})`,
                    parse_mode: 'Markdown'
                })
            });

            return res.json({ 
                method: "sendMessage", 
                chat_id: chatId, 
                text: "Дякую! Вікторія отримала ваш контакт і скоро зателефонує. До зустрічі! ✨", 
                reply_markup: { remove_keyboard: true } 
            });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text;

        // --- 2. ЛОГІКА ПАМ'ЯТІ ---
        if (userText === '/start') { 
            delete sessions[chatId]; 
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Чим цікавиться ваша дитина: малюванням чи створенням ігор? 🤖🎨" }); 
        }
        
        if (!sessions[chatId]) sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        // Обмежуємо історію для стабільності (останні 10 реплік)
        if (sessions[chatId].length > 12) sessions[chatId].splice(1, 1);

        // --- 3. ЗАПИТ ДО AI ---
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Замислився... Спробуйте ще раз! 🤔";
        sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

        // --- 4. ВІДПРАВКА ВІДПОВІДІ ---
        const payload = { chat_id: chatId, text: replyText };

        // Кнопка з'явиться лише якщо AI згенерував фразу-тригер
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

    } catch (e) { console.error("Error:", e); }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Stable Mentor is Live!`));
