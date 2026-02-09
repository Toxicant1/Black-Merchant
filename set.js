/* FORCE CONNECTION CONFIG
   This version removes weak fallbacks and forces the bot to stay online
*/

const sessionName = 'session';

// 🔐 FORCE SESSION (no empty fallback)
const session = process.env.SESSION 
  ? process.env.SESSION 
  : 'BLACK MD;;;uwREGJ6S#73l__UQ0rLy1c5KrcsxZvbtQAwMbLLpfFHa2ZMw3Fp4';
// 🚀 FORCE ENABLED FEATURES
const autobio = 'TRUE';
const autolike = 'TRUE';
const autoviewstatus = 'TRUE';
const welcomegoodbye = 'TRUE';
const autoread = 'TRUE';

// 🌍 FORCE PUBLIC MODE
const mode = 'PRIVATE';

// ☎️ FORCE ANTI-CALL
const anticall = 'TRUE';

// 🤖 BOT IDENTITY (LOCKED)
const botname = process.env.BOTNAME || '𝐁𝐋𝐀𝐂𝐊-𝐌𝐃 𝐁𝐎𝐓';
const author = process.env.STICKER_AUTHOR || '𝗕𝗢𝗧';
const packname = process.env.STICKER_PACKNAME || '𝐁𝐋𝐀𝐂𝐊𝐌𝐄𝐑𝐂𝐇𝐀𝐍𝐓';

// 👑 OWNER (LOCKED)
const dev = '254741819582';
const DevRaven = dev.split(",");

// 🛡️ SECURITY (FORCED)
const antibot = 'TRUE';
const antitag = 'TRUE';
const antilink = 'TRUE';
const antilinkall = 'TRUE';
const antiforeign = 'FALSE';
const antidel = 'TRUE';

// 🚫 BAD WORD CONTROL
const badwordkick = 'TRUE';
const bad = process.env.BAD_WORD || 'fuck';

// 📌 UI / MENU
const prefix = process.env.PREFIX || '.';
const menu = 'IMAGE';
const menulink = process.env.MENU_LINK || 'https://files.catbox.moe/jxxwms.jpeg';

// 📩 GPT DM (OPTIONAL BUT STABLE)
const gptdm = 'FALSE';

// 🟢 WA PRESENCE (PREVENTS SLEEP)
const wapresence = 'typing';

// 🌐 APP / SERVER
const appname = process.env.APP_NAME || 'BLACK-MD';
const herokuapi = process.env.HEROKU_API || '';
const mycode = '254';
const port = process.env.PORT || 10000;

// ⚠️ SYSTEM MESSAGES
const admin = '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗿𝗲𝘀𝗲𝗿𝘃𝗲𝗱 𝗳𝗼𝗿 𝗔𝗱𝗺𝗶𝗻𝘀!';
const group = '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗺𝗲𝗮𝗻𝘁 𝗳𝗼𝗿 𝗚𝗿𝗼𝘂𝗽𝘀!';
const botAdmin = '𝗜 𝗻𝗲𝗲𝗱 𝗔𝗱𝗺𝗶𝗻 𝗽𝗿𝗲𝘃𝗶𝗹𝗲𝗱𝗴𝗲𝘀!';
const NotOwner = '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗺𝗲𝗮𝗻𝘁 𝗳𝗼𝗿 𝘁𝗵𝗲 𝗼𝘄𝗻𝗲𝗿!';

module.exports = {
  session,
  sessionName,
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