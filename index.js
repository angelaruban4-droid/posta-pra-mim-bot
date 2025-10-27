// index.js
import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// === VARIÁVEIS DE AMBIENTE (.env) ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_EMAIL = process.env.GOOGLE_SERVICE_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

// === CONFIGURAÇÃO GOOGLE SHEETS ===
const auth = new google.auth.JWT(
  GOOGLE_SERVICE_EMAIL,
  null,
  GOOGLE_PRIVATE_KEY,
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth });

// === TELEGRAM BOT ===
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// === /start ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 Olá, ${msg.from.first_name}!
Sou o bot *Posta Pra Mim* 🤖

Comandos disponíveis:
📦 /categorias – Escolher categoria
🔗 Envie um link da Shopee, Magalu ou Mercado Livre
🚀 /enviar – Enviar mensagens automáticas
📊 /status – Verificar status`,
    { parse_mode: "Markdown" }
  );
});

// === CAPTURA DE DADOS SHOPEE ===
async function getShopeeData(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();

    const title = text.match(/"name":"([^"]+)"/)?.[1] || "Produto não identificado";
    const image = text.match(/"image":"([^"]+)"/)?.[1] || "";
    const price = text.match(/"price":(\d+)/)?.[1] / 100000 || 0;
    const oldPrice = text.match(/"price_before_discount":(\d+)/)?.[1] / 100000 || price;

    return {
      title,
      image,
      price: `R$ ${price.toFixed(2)}`,
      oldPrice: `R$ ${oldPrice.toFixed(2)}`,
    };
  } catch (error) {
    console.error("Erro Shopee:", error);
    return null;
  }
}

// === CAPTURA DE LINKS ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith("/")) return;

  if (text.includes("shopee.com")) {
    bot.sendMessage(chatId, "🔍 Capturando dados do produto, aguarde...");

    const data = await getShopeeData(text);
    if (!data) {
      return bot.sendMessage(chatId, "❌ Erro ao capturar os dados do produto. Verifique o link e tente novamente.");
    }

    const values = [
      [
        data.title,
        text,
        "Shopee",
        "Geral",
        data.image,
        data.oldPrice,
        data.price,
        "Curiosidade ou benefício",
        "Aproveite agora!",
        "",
        "Pendente",
        "Sim",
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Página1!A:L",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    bot.sendMessage(
      chatId,
      `✅ Produto salvo com sucesso!\n🛒 *${data.title}*\n💰 ${data.price}`,
      { parse_mode: "Markdown" }
    );
  }
});

// === ROTA TESTE WEBHOOK ===
app.get("/", (req, res) => res.send("🤖 Bot Posta Pra Mim ativo e rodando!"));
app.listen(3000, () => console.log("🚀 Servidor ativo na porta 3000."));
