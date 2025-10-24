/* ─────────────────────────────────────────────────────────
   BLACK MERCHANT — index.js
   Dark. Slim. Gothic. Strict.
   Features:
   - AutoBio (updates About every 30 minutes with: name | time | rotating gothic quote)
   - Anti-Delete (recovers text, images, audio posted and reposts)
   - Anti-Call (reject + strict warning)
   - Anti-Foreign filter
   - AutoLike (reacts with rotating dark emojis to viewed statuses)
   ───────────────────────────────────────────────────────── */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const figlet = require("figlet");
const express = require("express");
const FileType = require("file-type");

const app = express();
const logger = pino({ level: "silent" });

const {
  session,
  mode,
  prefix,
  autobio,
  autoviewstatus,
  autolike,
  anticall,
  antiforeign,
  port,
  mycode,
} = require("./set.js");

const { smsg, getBuffer } = require("./lib/ravenfunc");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require("./lib/ravenexif");
const Events = require("./action/events");
const makeInMemoryStore = require("./store/store.js");
const store = makeInMemoryStore({ logger });

// 🕯️ Gothic Quotes
const GOTHIC_QUOTES = [
  "𝔗𝔥𝔢 𝔐𝔢𝔯𝔠𝔥𝔞𝔫𝔱 𝔪𝔬𝔳𝔢𝔰 𝔦𝔫 𝔰𝔦𝔩𝔢𝔫𝔠𝔢.",
  "𝔅𝔩𝔞𝔠𝔨 𝔪𝔦𝔫𝔡, 𝔠𝔩𝔢𝔞𝔯 𝔭𝔲𝔯𝔭𝔬𝔰𝔢.",
  "𝔗𝔥𝔢 𝔇𝔞𝔯𝔨 𝔗𝔯𝔞𝔡𝔢 𝔫𝔢𝔳𝔢𝔯 𝔰𝔩𝔢𝔢𝔭𝔰.",
  "𝔄 𝔰𝔬𝔲𝔩 𝔬𝔣 𝔰𝔥𝔞𝔡𝔬𝔴𝔰, 𝔞 𝔪𝔦𝔫𝔡 𝔬𝔣 𝔰𝔱𝔢𝔢𝔩.",
  "𝔗𝔥𝔢 𝔐𝔢𝔯𝔠𝔥𝔞𝔫𝔱 𝔰𝔢𝔢𝔰 𝔞𝔩𝔩.",
  "𝔜𝔬𝔲 𝔱𝔯𝔦𝔢𝔡 𝔱𝔬 𝔥𝔦𝔡𝔢 𝔦𝔱. 𝔗𝔥𝔢 𝔐𝔢𝔯𝔠𝔥𝔞𝔫𝔱 𝔰𝔞𝔴 𝔦𝔱.",
  "𝔇𝔢𝔩𝔢𝔱𝔢𝔡 𝔱𝔯𝔲𝔱𝔥 𝔯𝔢𝔰𝔱𝔬𝔯𝔢𝔡.",
  "𝔇𝔬 𝔫𝔬𝔱 𝔠𝔞𝔩𝔩 𝔱𝔥𝔢 𝔐𝔢𝔯𝔠𝔥𝔞𝔫𝔱.",
  "𝔗𝔥𝔦𝔰 𝔩𝔦𝔫𝔢 𝔦𝔰 𝔫𝔬𝔱 𝔣𝔬𝔯 𝔳𝔬𝔦𝔠𝔢.",
  "𝔗𝔥𝔢 𝔐𝔢𝔯𝔠𝔥𝔞𝔫𝔱 𝔡𝔬𝔢𝔰 𝔫𝔬𝔱 𝔞𝔫𝔰𝔴𝔢𝔯 𝔠𝔞𝔩𝔩𝔰."
];

const DARK_EMOJIS = [
  "🖤","⚡","☠️","🔥","💀","🩸","⚔️","🕯️","👁️‍🗨️","🌑","💫","🦴","🎭","🌙","🦂","🕷️","👻","🌒","💢","♠️"
];

const color = (txt) => chalk.gray(txt);
const gothHeader = (text = "BLACK MERCHANT") =>
  chalk.white(figlet.textSync(text, { font: "Gothic", horizontalLayout: "default" }));

async function authentication() {
  const credsPath = path.join(__dirname, "session", "creds.json");
  if (!fs.existsSync(credsPath)) {
    if (!session) {
      console.log(color("Session missing. Add session string to set.js."));
      return;
    }
    try {
      const raw = session.replace(/^.*?;;;/, "");
      const buf = Buffer.from(raw, "base64");
      fs.mkdirSync(path.join(__dirname, "session"), { recursive: true });
      fs.writeFileSync(credsPath, buf);
      console.log(color("Session restored from string."));
    } catch (e) {
      console.error(chalk.red("Session restore failed:"), e.message);
    }
  }
}

let lastCallWarn = {};

async function startBlackMerchant() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "session"));
  const { version } = await fetchLatestBaileysVersion();

  console.log(gothHeader("BLACK MERCHANT"));
  console.log(color(`Baileys version: ${version.join ? version.join(".") : version}`));
  console.log(color("Starting..."));

  const client = makeWASocket({
    logger,
    printQRInTerminal: false,
    browser: ["Black Merchant", "Chrome", "1.0"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);
  client.ev.on("creds.update", saveCreds);

  client.ev.on("connection.update", (upd) => {
    const { connection, lastDisconnect } = upd;
    if (connection === "open") {
      console.log(color("Black Merchant connected."));
      client.sendMessage(client.user.id, { text: "Black Merchant online." }).catch(() => {});
      if (autobio === "TRUE") startAutoBio(client);
    } else if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log(color("Reconnecting..."));
        setTimeout(() => startBlackMerchant(), 4000);
      } else console.log(color("Logged out. Please re-authenticate."));
    }
  });

  // AntiCall refined
  client.ev.on("call", async (calls) => {
    if (anticall !== "TRUE") return;
    for (const c of calls) {
      await client.updateCall(c.id, "reject").catch(() => {});
      const jid = c.from;
      const now = Date.now();
      if (!lastCallWarn[jid] || now - lastCallWarn[jid] > 15000) {
        await client.sendMessage(jid, { text: "Do not call this number again." }).catch(() => {});
        lastCallWarn[jid] = now;
      }
    }
  });

  // AntiDelete handler
  client.ev.on("message.delete", async (data) => {
    try {
      if (!data || !data.keys) return;
      for (const key of data.keys) {
        const chat = key.remoteJid;
        if (key.fromMe) continue;
        const stored = store.loadMessage(chat, key.id);
        if (!stored || !stored.message) continue;

        const m = stored.message;
        await client.sendMessage(chat, { text: "You tried to hide it. The Merchant saw it." });
        const type = Object.keys(m)[0];

        if (m.conversation) await client.sendMessage(chat, { text: m.conversation });
        else if (m.extendedTextMessage?.text) await client.sendMessage(chat, { text: m.extendedTextMessage.text });
        else if (m.imageMessage?.url) {
          const buf = await getBuffer(m.imageMessage.url).catch(() => null);
          if (buf) await client.sendMessage(chat, { image: buf, caption: "Recovered image." });
        } else if (m.audioMessage?.url) {
          const buf = await getBuffer(m.audioMessage.url).catch(() => null);
          if (buf) await client.sendMessage(chat, { audio: buf, mimetype: "audio/ogg; codecs=opus" });
        }
      }
    } catch (err) {
      console.error("Anti-Delete:", err.message);
    }
  });

  // Main message handler
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages?.[0];
      if (!mek || !mek.message) return;
      mek.message =
        Object.keys(mek.message)[0] === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;

      // Auto view status
      if (autoviewstatus === "TRUE" && mek.key.remoteJid === "status@broadcast")
        await client.readMessages([mek.key]).catch(() => {});

      // Auto-like status with rotating emojis
      if (autolike === "TRUE" && mek.key.remoteJid === "status@broadcast") {
        try {
          const emoji = DARK_EMOJIS[Math.floor(Math.random() * DARK_EMOJIS.length)];
          await client.sendMessage(mek.key.remoteJid, { react: { key: mek.key, text: emoji } });
          console.log(color(`Auto-reacted to status with ${emoji}`));
        } catch (err) {
          console.error("AutoLike error:", err.message);
        }
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      const m = smsg(client, mek, store);

      try {
        const aiHandler = require("./modules/aiHandler").default || require("./modules/aiHandler");
        if (aiHandler) await aiHandler(client, m, store);
      } catch {}

      try {
        const commands = require("./main");
        if (commands) await commands(client, m, chatUpdate, store);
      } catch {}
    } catch (err) {
      console.error("Message handler error:", err.message);
    }
  });

  // Anti-Foreign
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === "TRUE" && update.action === "add") {
      for (const jid of update.participants) {
        const phone = jid.split("@")[0].replace(/\D/g, "");
        const code = (mycode || "").replace(/\+/g, "");
        if (code && !phone.startsWith(code)) {
          await client.groupParticipantsUpdate(update.id, [jid], "remove").catch(() => {});
          await client.sendMessage(update.id, { text: "Foreign numbers are not allowed.", mentions: [jid] });
        }
      }
    }
    Events(client, update);
  });

  return client;
}

// AutoBio update every 30 mins
function startAutoBio(client) {
  const INTERVAL = 30 * 60 * 1000;
  const update = async () => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" });
    const date = now.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" });
    const quote = GOTHIC_QUOTES[Math.floor(Math.random() * GOTHIC_QUOTES.length)];
    const status = `Black Merchant | ${date} ${time} | ${quote}`;
    await client.updateProfileStatus(status).catch(() => {});
    console.log(color("AutoBio updated."));
  };
  update();
  setInterval(update, INTERVAL);
}

// Static host
app.use(express.static("pixel"));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(port || 3000, () => console.log(color(`Server running on port ${port || 3000}`)));

startBlackMerchant();

const file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(color("File changed. Restarting..."));
  process.exit(0);
});