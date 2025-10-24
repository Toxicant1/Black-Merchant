/* ─────────────────────────────────────────────────────────
   BLACK MERCHANT — index.js
   Dark. Slim. Gothic. Strict.
   Features:
   - AutoBio (updates About every 30 minutes with: name | time | rotating gothic quote)
   - Anti-Delete (recovers text, images, voice/audio posted and reposts to same chat)
   - Anti-Call (reject + strict warning; repeat callers warned again)
   - Minimal/dark console logs (figlet + chalk)
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

// settings from set.js
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

// helpers (assumed present in your project)
const { smsg, isUrl, getBuffer } = require("./lib/ravenfunc");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require("./lib/ravenexif");
const Events = require("./action/events");
const makeInMemoryStore = require("./store/store.js");
const store = makeInMemoryStore({ logger });

// Gothic quotes (you can expand/change)
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

// console styling helpers - dark, slim
const color = (txt) => chalk.gray(txt);
const gothHeader = (text = "BLACK MERCHANT") =>
  chalk.white(figlet.textSync(text, { font: "Gothic", horizontalLayout: "default" }));

// restore session if session string provided in env-style session var
async function authentication() {
  const credsPath = path.join(__dirname, "session", "creds.json");
  if (!fs.existsSync(credsPath)) {
    if (!session) {
      console.log(color("Session missing. Add session string to set.js."));
      return;
    }
    try {
      // session is expected to be base64 prefixed like "BLACKMERCHANT;;;<base64>"
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

let lastCallWarn = {}; // track per-jid last warn timestamp

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

  // connection updates
  client.ev.on("connection.update", (upd) => {
    const { connection, lastDisconnect } = upd;
    if (connection === "open") {
      console.log(color("Black Merchant connected."));
      // announce to self (private)
      client.sendMessage(client.user.id, { text: "Black Merchant online." }).catch(() => {});
      // start autobio rotation if enabled
      if (autobio === "TRUE") startAutoBio(client);
    } else if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log(color("Connection closed unexpectedly, reconnecting..."));
        setTimeout(() => startBlackMerchant(), 4000);
      } else {
        console.log(color("Logged out. Please re-authenticate."));
      }
    }
  });

  // refined anticall: reject -> single warning -> repeated callers get repeated warnings (no auto-block to avoid accidental blocks)
  client.ev.on("call", async (calls) => {
    if (anticall !== "TRUE") return;
    try {
      for (const c of calls) {
        // reject call
        await client.updateCall(c.id, "reject").catch(() => {});
        const jid = c.from;
        const now = Date.now();
        const last = lastCallWarn[jid] || 0;
        const gap = now - last;
        // warn once every 15 seconds per caller
        if (gap > 15000) {
          await client.sendMessage(jid, { text: "Do not call this number again." }).catch(() => {});
          lastCallWarn[jid] = now;
          console.log(color(`Warned caller ${jid}`));
        } else {
          // quick suppressed log for repeat calls
          console.log(color(`Repeat call from ${jid} suppressed.`));
        }
      }
    } catch (err) {
      console.error("Anti-Call error:", err.message);
    }
  });

  // Anti-Delete logic:
  // - When a message is deleted, try to load it from the store and repost accordingly.
  // - Repost text, images, audio (voice notes). Keep strict gothic phrasing.
  client.ev.on("message.delete", async (data) => {
    try {
      if (!data || !data.keys) return;
      for (const key of data.keys) {
        const chat = key.remoteJid;
        const msgId = key.id;
        // do not repost if message came from bot itself
        if (key.fromMe) continue;

        // load stored message (depends on your store implementation)
        const stored = store.loadMessage(chat, msgId);
        if (!stored || !stored.message) {
          // fallback: nothing to recover
          continue;
        }

        const m = stored.message;
        const type = Object.keys(m)[0];

        // strict gothic notification
        await client.sendMessage(chat, { text: "You tried to hide it. The Merchant saw it." }).catch(() => {});

        // text
        if (m.conversation) {
          await client.sendMessage(chat, { text: m.conversation }).catch(() => {});
        } else if (m.extendedTextMessage && m.extendedTextMessage.text) {
          await client.sendMessage(chat, { text: m.extendedTextMessage.text }).catch(() => {});
        } else if (m.imageMessage || m.videoMessage || m.documentMessage || m.stickerMessage) {
          // try to fetch media buffer using your helper getBuffer or by fetching url
          try {
            let buffer = null;
            if (m.imageMessage && m.imageMessage.url) {
              buffer = await getBuffer(m.imageMessage.url).catch(() => null);
              if (!buffer && m.imageMessage.mimetype && m.imageMessage.fileSha256) {
                // fallback: try to download via downloadContent (if available)
                const stream = await client.downloadMediaMessage({ message: m, directPath: null }).catch(() => null);
                if (stream) {
                  const chunks = [];
                  for await (const chunk of stream) chunks.push(chunk);
                  buffer = Buffer.concat(chunks);
                }
              }
              if (buffer) {
                await client.sendMessage(chat, { image: buffer, caption: "Recovered image." }).catch(() => {});
              }
            } else if (m.videoMessage && m.videoMessage.url) {
              buffer = await getBuffer(m.videoMessage.url).catch(() => null);
              if (buffer) await client.sendMessage(chat, { video: buffer, caption: "Recovered video." }).catch(() => {});
            } else if (m.documentMessage && m.documentMessage.url) {
              buffer = await getBuffer(m.documentMessage.url).catch(() => null);
              if (buffer) {
                const ft = await FileType.fromBuffer(buffer).catch(() => ({ ext: "bin", mime: "application/octet-stream" }));
                await client.sendMessage(chat, {
                  document: buffer,
                  fileName: `recovered.${ft.ext || "bin"}`,
                  mimetype: ft.mime || "application/octet-stream",
                }).catch(() => {});
              }
            } else if (m.stickerMessage && m.stickerMessage.url) {
              buffer = await getBuffer(m.stickerMessage.url).catch(() => null);
              if (buffer) await client.sendMessage(chat, { sticker: buffer }).catch(() => {});
            }
          } catch (e) {
            console.error("Anti-Delete media recovery error:", e.message);
          }
        } else if (m.audioMessage) {
          // audio or voice note
          try {
            let buffer = null;
            if (m.audioMessage.url) {
              buffer = await getBuffer(m.audioMessage.url).catch(() => null);
            } else {
              // try downloadMediaMessage
              const stream = await client.downloadMediaMessage({ message: m, directPath: null }).catch(() => null);
              if (stream) {
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                buffer = Buffer.concat(chunks);
              }
            }
            if (buffer) {
              await client.sendMessage(chat, { audio: buffer, mimetype: "audio/ogg; codecs=opus" }).catch(() => {});
            }
          } catch (err) {
            console.error("Anti-Delete audio error:", err.message);
          }
        } else {
          // unknown type fallback: send JSON for debugging (minimal)
          await client.sendMessage(chat, { text: "[Recovered message: unsupported type]" }).catch(() => {});
        }

        console.log(color(`Recovered deleted message in ${chat} (id: ${msgId})`));
      }
    } catch (err) {
      console.error("Anti-Delete handler error:", err.message);
    }
  });

  // message.upsert handler (main incoming messages)
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages && chatUpdate.messages[0];
      if (!mek) return;
      if (!mek.message) return;

      // ephemeral handling
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

      // auto view statuses
      if (autoviewstatus === "TRUE" && mek.key.remoteJid === "status@broadcast") {
        await client.readMessages([mek.key]).catch(() => {});
      }

      // optionally autolike statuses (react) - keep minimal/no emojis if needed; this example avoids emojis
      // if (autolike === "TRUE" && mek.key.remoteJid === "status@broadcast") { ... }

      // ignore if bot in private mode
      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;

      const m = smsg(client, mek, store);

      // AI/commands modular call - keep your existing handlers
      try {
        const aiHandler = require("./modules/aiHandler").default || require("./modules/aiHandler");
        if (aiHandler) await aiHandler(client, m, store).catch(() => {});
      } catch (e) {
        // modules may not exist; ignore
      }

      try {
        const commands = require("./main");
        if (commands) await commands(client, m, chatUpdate, store).catch(() => {});
      } catch (e) {
        // ignore if no commands
      }
    } catch (err) {
      console.error("Message upsert error:", err.message);
    }
  });

  // group participant update - anti-foreign + events
  client.ev.on("group-participants.update", async (update) => {
    try {
      if (antiforeign === "TRUE" && update.action === "add") {
        for (const p of update.participants) {
          const jid = p;
          const phone = jid.split("@")[0].replace(/\D/g, "");
          const code = (mycode || "").replace(/\+/g, "");
          if (code && !phone.startsWith(code)) {
            await client.groupParticipantsUpdate(update.id, [jid], "remove").catch(() => {});
            await client.sendMessage(update.id, { text: "Foreign numbers are not allowed here." , mentions: [jid]}).catch(() => {});
            console.log(color(`Removed foreign number ${jid} from ${update.id}`));
          }
        }
      }
      Events(client, update);
    } catch (e) {
      console.error("group-participants.update error:", e.message);
    }
  });

  return client;
}

// AutoBio: Update "About" / profile status every 30 minutes
function startAutoBio(client) {
  try {
    const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    const updateNow = async () => {
      try {
        const now = new Date();
        const time = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" });
        const date = now.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" });
        const quote = GOTHIC_QUOTES[Math.floor(Math.random() * GOTHIC_QUOTES.length)];
        const status = `Black Merchant | ${date} ${time} | ${quote}`;
        await client.updateProfileStatus(status).catch(() => {});
        console.log(color("AutoBio updated."));
      } catch (err) {
        console.error("AutoBio update error:", err.message);
      }
    };
    // initial update immediately
    updateNow();
    // schedule interval
    setInterval(updateNow, INTERVAL_MS);
  } catch (err) {
    console.error("startAutoBio error:", err.message);
  }
}

// static hosting (if you use index.html/dashboard)
app.use(express.static("pixel"));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(port || 3000, () => console.log(color(`Server running on port ${port || 3000}`)));

// start bot
startBlackMerchant().catch((e) => {
  console.error("Failed to start Black Merchant:", e.message);
  process.exit(1);
});

// hot-reload on file change (simple)
const file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.gray("File changed. Restarting..."));
  process.exit(0);
});