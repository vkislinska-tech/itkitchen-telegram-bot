const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

// Ліміт історії діалогу
const MAX_HISTORY = 10; 

const SYSTEM_PROMPT = `
Ти — інтелектуальний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка).

ТВОЯ БАЗА ЗНАНЬ:
1. ЛОКАЦІЯ: проспект Героїв Небесної Сотні, 18/4, ЖК «У квартал». Цокольний поверх, безпечно. 📍🛡️
2. ВІК: 7–17 років (є групи для дорослих). Якщо 6 років — запрошуємо на пробне! Малі групи (6-8 дітей). 👥✨
3. РОЗКЛАД: Формується зараз (активний запис в групи після ознайомчих занять). Вікторія підбере зручний час при дзвінку. 🏗️
4. ЦІНИ: Від 2800 грн на місяць. 💰
5. КУРСИ:
   - Digital Art — це ЦИФРОВЕ МАЛЮВАННЯ та ілюстрація на iPad (Procreate). 🎨🖌️
   - Геймдизайн — створення ігор у Roblox та Minecraft. 🎮
   - 3D-моделювання — створення об'єктів та 3D-друк на принтері Bambulab. 🏗️🖨️
   - Креативне програмування — логіка та код для дітей. 💻
   - Блогінг та медіа — створення контенту, монтаж відео, ТікТок. 📱🎥
   - Штучний інтелект — навчання роботі з нейромережами. 🤖
❌ РОБОТОТЕХНІКИ НЕМАЄ.

ПРАВИЛА СПІЛКУВАННЯ:
- ГАРНИЙ ТОН: Обов'язково будь ввічливим! Вітайся на початку розмови ✨. Але не повторюй "Привіт" у кожній наступній репліці діалогу.
- ПРОАКТИВНІСТЬ: Кожна відповідь має закінчуватися твоїм запитанням до батьків. Веди діалог!
- НІКОЛИ не кажи "я не маю доступу" або "я не знаю". Використовуй інформацію про фазу передзапису.
- Пропонуй дзвінок Вікторії після 4-го повідомлення або коли клієнт прямо спитає про запис чи розклад.
- ТРИГЕР КНОПКИ: Якщо згодні, пиши ТІЛЬКИ: "Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"
`;

app.get('/alive', (req, res) => res.send('Kitchen is heating up! 👨‍🍳'));

app.post('/', async (req, res) => {
    res.sendStatus(200);

    try {
        const { message } = req.body;
        if (!message || !message.chat) return;
        const chatId = message.chat.id;

        // --- 1. ОБРОБКА КОНТАКТУ ---
        if (message.contact && ADMIN_ID) {
            const chatLink = `tg://user?id=${message.from.id}`;
            let context = "Передзапис";
            if (sessions[chatId]) {
                context = sessions[chatId].filter(msg => msg.role === "user").map(msg => msg.parts[0].text).slice(-3).join(" | ");
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
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chat_id: chatId, 
                    text: "Дякую! Вікторія отримала ваш контакт і зателефонує вам найближчим часом! ✨", 
                    reply_markup: { remove_keyboard: true } 
                })
            });
            return;
        }

        if (!message.text) return;
        let userText = message.text;
       
// --- ЛОГІКА ЛОКАЦІЇ (КАРТА) ---
const lowText = userText.toLowerCase().trim();
if (lowText === '/location' || lowText.includes('локація')) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            latitude: 50.39925, 
            longitude: 30.33856
        })
    });
}
       
        // --- 2. ЛОГІКА /START ---
        if (userText === '/start') { 
            sessions[chatId] = [];
            userText = "Привіт! Я розпочинаю чат. Розкажи, хто ти і як можеш мені допомогти.";
        }
        
        if (!sessions[chatId]) sessions[chatId] = [];

        // Захист черги повідомлень (User -> Model -> User)
        if (sessions[chatId].length > 0 && sessions[chatId][sessions[chatId].length - 1].role === "user") {
            sessions[chatId].pop();
        }

        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        if (sessions[chatId].length > MAX_HISTORY) {
            sessions[chatId] = sessions[chatId].slice(-MAX_HISTORY);
        }

        // --- 3. ЗАПИТ ДО GEMINI 2.0 FLASH ---
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: sessions[chatId],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await response.json();
        let replyText = "";

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            replyText = data.candidates[0].content.parts[0].text;
            sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });
        } else {
            sessions[chatId].pop(); 
            replyText = "Замислився трішки... Спробуйте ще раз! 🤔";
        }

        // --- 4. ВІДПРАВКА ВІДПОВІДІ ---
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

    } catch (e) { console.error("Critical Error:", e); }
});

// --- 5. "БУДИЛЬНИК" ДЛЯ RENDER ---
const RENDER_URL = 'https://itkitchen-telegram-bot.onrender.com/alive';

setInterval(async () => {
    try {
        const res = await fetch(RENDER_URL);
        if (res.ok) console.log('⏰ Будильник: Кухня гріється! 👨‍🍳');
    } catch (e) {
        console.error('❌ Помилка будильника:', e.message);
    }
}, 14 * 60 * 1000); // Кожні 14 хвилин

app.listen(PORT, () => console.log(`Mentor is online and warm!`));
