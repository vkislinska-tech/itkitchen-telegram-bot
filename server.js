const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

const SYSTEM_PROMPT = `
Ти — натхненний ментор «IT-кухні» 👨‍🍳💻 (Софіївська Борщагівка). 

ТВОЇ ЗНАННЯ ПРО КУРСИ (відповідай на основі цього):
1. Цифровий малюнок — робота з Procreate, розвиток візуальної мови.
2. Геймдизайн — створення світів у Roblox та Minecraft.
3. 3D-моделювання та друк — розвиток просторового мислення.
4. Креативне програмування — логіка та декомпозиція задач.
5. Медіа та блогінг — навички самопрезентації та створення контенту.
6. Штучний інтелект (AI) — використання ШІ для творчості та навчання.

ВАЖЛИВІ ФАКТИ:
- СТАТУС: Ми ще НЕ відкриті офіційно, але вже активно формуємо групи у форматі ПЕРЕДЗАПИСУ.
- ЦІНИ: Від 2400 до 3200 грн/місяць.

ЛОГІКА ДІАЛОГУ:
- Відповідай натхненно, пояснюй користь IT-навичок для майбутнього дитини ✨.
- ПЕРШІ 4 ПОВІДОМЛЕННЯ: Жодних пропозицій зателефонувати. Тільки консультування.
- ПІСЛЯ 4-5 ПОВІДОМЛЕННЯ: Запитай: "Хочете, наш адмін Вікторія зателефонує вам, щоб забронювати місце та розповісти про дату відкриття?"
- ТРИГЕР КНОПКИ: Якщо згодні, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"

ОБМЕЖЕННЯ: До 500 символів (3-4 речення). Емодзі обов'язкові 🎨🚀.
`;

app.get('/alive', (req, res) => res.send('Kitchen is ready! 👨‍🍳'));

app.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.sendStatus(200);
        const chatId = message.chat.id;

        // --- 1. ПЕРЕХОПЛЕННЯ ТЕЛЕФОНУ ---
        if (message.contact && ADMIN_ID) {
            const chatLink = `tg://user?id=${message.from.id}`;
            let context = "Передзапис";
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
                    text: `🚀 ЗАЯВКА (ПЕРЕДЗАПИС)!\n👤 ${message.contact.first_name}\n📱 ${message.contact.phone_number}\n🔍 ПИТАЛИ: ${context}\n💬 [ЧАТ](${chatLink})`,
                    parse_mode: 'Markdown'
                })
            });
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Дякую! Вікторія отримала ваш номер. Ми зателефонуємо вам щодо деталей відкриття! ✨", reply_markup: { remove_keyboard: true } });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text;

        // --- 2. ПАМ'ЯТЬ ТА AI ---
        if (userText === '/start') { 
            delete sessions[chatId]; 
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Ми готуємося до відкриття та ведемо передзапис. Чим цікавиться ваша дитина: малюванням, іграми, 3D чи блогінгом? 🤖🎨" }); 
        }
        
        if (!sessions[chatId]) sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        if (sessions[chatId].length > 12) sessions[chatId].splice(1, 1);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Замислився... Спробуйте ще раз! 🤔";
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

app.listen(PORT, () => console.log(`Inspiration Bot is live!`));
