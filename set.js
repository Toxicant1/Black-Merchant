/**
 * 🖤 set.js — Centralized Bot Configuration
 * 
 * Clean + Stable version for BELTAH / BLACK MERCHANT bot.
 * Supports Mega.nz or direct session formats.
 */

const FALLBACK_SESSION_RAW = 'BLACK MERCHANT;;;gz8hQS5A#QKqvhVjy6c5tCG5ETa1qp-vxSKKQBCUVq-1GD_plBms';
const rawFromEnv = (process.env.SESSION || process.env.SESSION_ID || '').trim();
const rawInput = rawFromEnv || FALLBACK_SESSION_RAW || '';

/**
 * Normalize any session format to "BLACK MERCHANT;;;<ID>#<KEY>"
 */
function normalizeSession(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let s = raw.trim();

  // Remove quotes if present
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1).trim();
  }

  // Remove "session" prefix if typed
  s = s.replace(/^session\s*/i, '').trim();

  // If full Mega link (https://mega.nz/file/XXXX#YYYY)
  if (s.startsWith('https://mega.nz/file/')) {
    const lastPart = s.split('/').pop();
    if (lastPart.includes('#')) {
      return 'BLACK MERCHANT;;;' + lastPart.trim();
    }
    return '';
  }

  // Already formatted correctly
  if (s.startsWith('BLACK MERCHANT;;;')) return s.trim();

  // If looks like ID#KEY
  if (s.includes('#') && s.length > 5) return 'BLACK MERCHANT;;;' + s.trim();

  return '';
}

const session = normalizeSession(rawInput);

// 🌐 General Bot Settings
const autobio = process.env.AUTOBIO || 'TRUE';
const autolike = process.env.AUTOLIKE_STATUS || 'TRUE';
const autoviewstatus = process.env.AUTOVIEW_STATUS || 'TRUE';
const welcomegoodbye = process.env.WELCOMEGOODBYE || 'FALSE';
const prefix = process.env.PREFIX || '';
const appname = process.env.APP_NAME || 'BLACK MERCHANT';
const gptdm = process.env.GPT_INBOX || 'FALSE';
const mode = process.env.MODE || 'PUBLIC';
const anticall = process.env.AUTOREJECT_CALL || 'TRUE';
const antibot = process.env.ANTIBOT || 'FALSE';
const antitag = process.env.ANTITAG || 'TRUE';
const autoread = process.env.AUTOREAD || 'FALSE';
const antidel = process.env.ANTIDELETE || 'TRUE';
const antilink = process.env.ANTILINK || 'TRUE';
const antilinkall = process.env.ANTILINK_ALL || 'TRUE';
const antiforeign = process.env.ANTIFOREIGN || 'FALSE';
const mycode = process.env.CODE || '254';
const port = process.env.PORT || 10000;

// 💬 Bot Info & Personality
const botname = process.env.BOTNAME || '🖤 𝐁𝐋𝐀𝐂𝐊 𝐌𝐄𝐑𝐂𝐇𝐀𝐍𝐓';
const author = process.env.STICKER_AUTHOR || '🖤 𝐌𝐄𝐑𝐂𝐇𝐀𝐍𝐓';
const packname = process.env.STICKER_PACKNAME || '🖤 𝐁𝐋𝐀𝐂𝐊 𝐌𝐄𝐑𝐂𝐇𝐀𝐍𝐓';
const menulink = process.env.MENU_LINK || 'https://files.catbox.moe/jxxwms.jpeg';
const menu = process.env.MENU_TYPE || 'IMAGE';
const wapresence = process.env.WA_PRESENCE || 'online';

// 👑 Ownership
const dev = process.env.DEV || '254741819582';
const DevRaven = dev.split(",");
const herokuapi = process.env.HEROKU_API || '';
const badwordkick = process.env.BAD_WORD_KICK || 'FALSE';
const bad = process.env.BAD_WORD || 'fuck';

// 🚫 Restriction Messages
const admin = process.env.ADMIN_MSG || '⚠️ Command reserved for *Admins only!*';
const group = process.env.GROUP_ONLY_MSG || '⚠️ Command meant for *Groups only!*';
const botAdmin = process.env.BOT_ADMIN_MSG || '⚠️ I need *Admin privileges!*';
const NotOwner = process.env.NOT_OWNER_MSG || '⚠️ Only the *Bot Owner* can do this!';

// 🧠 Export Everything
module.exports = {
  session,
  autobio,
  author,
  packname,
  dev,
  DevRaven,
  badwordkick,
  bad,
  mode,
  group,
  NotOwner,
  botname,
  botAdmin,
  antiforeign,
  menu,
  autoread,
  antilink,
  admin,
  mycode,
  antilinkall,
  anticall,
  antitag,
  antidel,
  wapresence,
  welcomegoodbye,
  antibot,
  herokuapi,
  prefix,
  port,
  gptdm,
  appname,
  autolike,
  autoviewstatus,
  menulink
};