import dotenv from 'dotenv';
dotenv.config();

import { WebcastPushConnection } from 'tiktok-live-connector';
import TelegramBot from 'node-telegram-bot-api';

// Environment
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALERT_KEYWORDS = (process.env.ALERT_KEYWORDS || '').split(',').map(s => s.trim()).filter(Boolean);

// Config
const NOT_ALERT_USERNAME = [
    '_babyy.m',
    'uenxq_'
]

if (!TIKTOK_USERNAME) {
  console.error('Missing TIKTOK_USERNAME in .env');
  process.exit(1);
}
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}
if (!TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_CHAT_ID in .env');
  process.exit(1);
}

// Create Telegram bot (polling disabled because we only send messages)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// Create TikTok connection
const tiktok = new WebcastPushConnection(TIKTOK_USERNAME);

// Helper: send alert to Telegram
async function sendTelegramAlert(text: string) {
  try {
    await bot.sendMessage(TELEGRAM_CHAT_ID!, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Failed to send Telegram message', err);
  }
}

// Connect and listen
export const startBot = async () => {
  console.log(`Connecting to TikTok live: ${TIKTOK_USERNAME} ...`);
  try {
    const state = await tiktok.connect();
    console.log(`Connected to roomId=${state.roomId}`);
    console.log(`Connected to Telegram chat: ${TELEGRAM_CHAT_ID}`);
  } catch (err) {
    console.error('Failed to connect to TikTok live:', err);
    process.exit(1);
  }

  // Listen for chat messages
  tiktok.on('chat', async (data: any) => {
      try {        
      const nickname = data.nickname || data.user.uniqueId || 'Unknown';
      const userId = data?.uniqueId
      const comment = data.comment || data['comment'] || '';
      const msg = `<b>${escapeHtml(nickname)} </b> \n` +
                  `<b>-</b> ${escapeHtml(comment)}`;

      // If ALERT_KEYWORDS specified, only send if contains one
      if (ALERT_KEYWORDS.length > 0) {
        const lc = comment.toLowerCase();
        const matched = ALERT_KEYWORDS.some(k => lc.includes(k.toLowerCase()));
        if (!matched) return; // ignore
      }

      console.log(`Comment from ${nickname}: ${comment}`);      
      if(NOT_ALERT_USERNAME.includes(userId)) {
        console.log(`Ignoring comment from ${nickname}`);
        return; // ignore comments from NOT_ALERT_USERNAME
      }

      await sendTelegramAlert(msg);
    } catch (err) {
      console.error('Error handling chat event', err);
    }
  });

  // Optional: other events
  tiktok.on('gift', (data: any) => {
    console.log('Gift event', data);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Disconnecting...');
    try { tiktok.disconnect(); } catch (e) {}
    process.exit(0);
  });
}

// Simple HTML-escape helper
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

startBot()