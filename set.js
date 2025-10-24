/**
 * set.js
 * Centralized configuration for the bot.
 * 
 * Supports multiple session formats and normalizes them to:
 * 'BLACK MD;;;<ID>#<KEY>'
 */

const FALLBACK_SESSION_RAW = 'BLACK MD;;;gz8hQS5A#QKqvhVjy6c5tCG5ETa1qp-vxSKKQBCUVq-1GD_plBms';
const rawFromEnv = (process.env.SESSION || process.env.SESSION_ID || '').trim();
const rawInput = rawFromEnv || FALLBACK_SESSION_RAW || '';

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let s = raw.trim();

  // Remove surrounding quotes if any
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1).trim();
  }

  // Remove 'session' prefix if present (case-insensitive)
  if (s.toLowerCase().startsWith('session')) {
    s = s.replace(/^session\s*/i, '').trim();
  }

  // If already in expected prefixed format: 'BLACK MD;;;<ID>#<KEY>'
  if (s.startsWith('BLACK MD;;;')) {
    const rest = s.slice('BLACK MD;;;'.length).trim();
    if (rest.length > 5) return 'BLACK MD;;;' + rest;
    return '';
  }

  // If it is a MEGA URL (e.g., https://mega.nz/file/<ID>#<KEY>)
  if (s.startsWith('https://mega.nz/file/')) {
    const parts = s.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('#') && lastPart.length > 5) {
      return 'BLACK MD;;;' + lastPart;
    }
    return '';
  }

  // If it looks like <ID>#<KEY> (at least 5 chars)
  if (s.includes('#') && s.length > 5) {
    return 'BLACK MD;;;' + s;
  }

  // Otherwise, can't parse
  return '';
}

const session = normalizeSession(rawInput);

// Other environment variables with defaults
const autobio = process.env.AUTOBIO || 'TRUE';
const autolike = process.env.AUTOLIKE_STATUS || 'TRUE';
const autoviewstatus = process.env.AUTOVIEW_STATUS || 'TRUE';
const welcomegoodbye = process.env.WELCOMEGOODBYE || 'FALSE';
const prefix = process.env.PREFIX || '';
const appname = process.env.APP_NAME || '';
const herokuapi = process.env.HEROKU_API;
const gptdm = process.env.GPT_INBOX || 'FALSE';
const mode = process.env.MODE || 'PRIVATE';
const anticall = process.env.AUTOREJECT_CALL || 'TRUE';
const botname = process.env.BOTNAME || '𝐁𝐋𝐀𝐂𝐊𝐌𝐀𝐂𝐇𝐀𝐍𝐓 𝐁𝐎𝐓';
const antibot = process.env.ANTIBOT || 'FALSE';
const author = process.env.STICKER_AUTHOR || '𝗕𝗢𝗧';
const packname = process.env.STICKER_PACKNAME || '𝐁𝐋𝐀𝐂𝐊𝐌𝐀𝐂𝐇𝐀𝐍𝐓 𝐁𝐎𝐓';
const antitag = process.env.ANTITAG || 'TRUE';
const dev = process.env.DEV || '‎254741819582';
const menulink = process.env.MENU_LINK || 'https://files.catbox.moe/jxxwms.jpeg';
const menu = process.env.MENU_TYPE || 'IMAGE';
const DevRaven = dev.split(",");
const badwordkick = process.env.BAD_WORD_KICK || 'FALSE';
const bad = process.env.BAD_WORD || 'fuck';
const autoread = process.env.AUTOREAD || 'FALSE';
const antidel = process.env.ANTIDELETE || 'TRUE';
const admin = process.env.ADMIN_MSG || '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗿𝗲𝘀𝗲𝗿𝘃𝗲𝗱 𝗳𝗼𝗿 𝗔𝗱𝗺𝗶𝗻𝘀!';
const group = process.env.GROUP_ONLY_MSG || '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗺𝗲𝗮𝗻𝘁 𝗳𝗼𝗿 𝗚𝗿𝗼𝘂𝗽𝘀!';
const botAdmin = process.env.BOT_ADMIN_MSG || '𝗜 𝗻𝗲𝗲𝗱 𝗔𝗱𝗺𝗶𝗻 𝗽𝗿𝗲𝘃𝗶𝗹𝗲𝗱𝗴𝗲𝘀!';
const NotOwner = process.env.NOT_OWNER_MSG || '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗺𝗲𝗮𝗻𝘁 𝗳𝗼𝗿 𝘁𝗵𝗲 𝗼𝘄𝗻𝗲𝗿!';
const wapresence = process.env.WA_PRESENCE || 'online';
const antilink = process.env.ANTILINK || 'TRUE';
const mycode = process.env.CODE || '254';
const antiforeign = process.env.ANTIFOREIGN || 'FALSE';
const port = process.env.PORT || 10000;
const antilinkall = process.env.ANTILINK_ALL || 'TRUE';

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
  autoviewstatus
};