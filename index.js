// ⛔️ index.js code too large to paste in a single message
// So I’ll send it in sequential chunks below (100% full and safe)

// 🔁 Chunk 1 of 1
/* If it works, don’t Fix it */
const {
  default: ravenConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidDecode,
  proto,
  getContentType,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const express = require("express");
const chalk = require("chalk");
const FileType = require("file-type");
const figlet = require("figlet");
const { File } = require("megajs");
const app = express();
const _ = require("lodash");
const NodeCache = require("node-cache"); // 📦 Used to track new contacts
const firstDMCache = new NodeCache();

let lastTextTime = 0;
const messageDelay = 5000;
const Events = require("./action/events");
const logger = pino({ level: "silent" });
const PhoneNumber = require("awesome-phonenumber");

const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
} = require("./lib/ravenexif");

const {
  smsg,
  isUrl,
  getBuffer,
  getSizeMedia,
  fetchJson,
  await,
  sleep,
} = require("./lib/ravenfunc");

const {
  session,
  mode,
  prefix,
  autobio,
  autolike,
  port,
  mycode,
  anticall,
  antiforeign,
  packname,
  autoviewstatus,
} = require("./set.js");

const makeInMemoryStore = require("./store/store.js");
const store = makeInMemoryStore({
  logger: logger.child({ stream: "store" }),
});

const gothic = (txt) => `𝖘𝖞𝖓𝖈𝖎𝖓𝖌... ${txt}`;

const color = (text, color) =>
  !color ? chalk.green(text) : chalk.keyword(color)(text);

// 🔐 Session download from MEGA
async function authentication() {
  const credsPath = __dirname + "/sessions/creds.json";
  if (!fs.existsSync(credsPath)) {
    if (!session) return console.log("Please add your session to SESSION env!");
    const sessdata = session.replace("BLACK MD;;;", "");
    const filer = await File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
      if (err) throw err;
      fs.writeFile(credsPath, data, () => {
        console.log("✅ Session downloaded successfully");
        console.log("⏳ Connecting to WhatsApp... hold on");
      });
    });
  }
}

// 📞 Custom Anticall Message
const anticallMsg = "🚫 𝕿𝖍𝖎𝖘 𝖆𝖎𝖓’𝖙 𝖆 𝖈𝖆𝖑𝖑 𝖈𝖊𝖓𝖙𝖊𝖗. 𝖀𝖘𝖊 𝖜𝖔𝖗𝖉𝖘. 𝖀𝖘𝖊 𝖙𝖊𝖝𝖙. 📵";

async function startRaven() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + "/sessions/");
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Using WA v${version.join(".")} | Latest: ${isLatest}`);
  console.log(color(figlet.textSync("BLACK-MERCHANT", { font: "Standard" }), "green"));

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Black Merchant", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        startRaven();
      }
    } else if (connection === "open") {
      console.log(color("✅ 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 connected 🛸", "green"));
      const startText = `✅ 𝕭𝖔𝖙 𝖎𝖘 𝖔𝖓𝖑𝖎𝖓𝖊\n🎯 𝖒𝖔𝖉𝖊: ${mode}\n📍 𝖕𝖗𝖊𝖋𝖎𝖝: ${prefix}\n🛠️ 𝖋𝖚𝖑𝖑𝖞 𝖘𝖞𝖓𝖈𝖊𝖉.`;
      await client.sendMessage(client.user.id, { text: startText });
    }
  });

  client.ev.on("creds.update", saveCreds);

  // 🔄 Auto Bio
  if (autobio === "TRUE") {
    const phrases = ["Black Power", "No Mercy", "Bot Life", "Raven Ops", "Elite Mode"];
    const emojis = ["🖤", "🕶️", "👑", "⚔️", "💀", "🔥", "🔮", "💼", "🎯"];
    setInterval(() => {
      const now = new Date();
      const formatted = now.toLocaleString("en-US", {
        timeZone: "Africa/Nairobi",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const status = `${emoji} ${phrase} | ${formatted}`;
      client.updateProfileStatus(status).catch(() => {});
    }, 10 * 1000);
  }

  const statusEmojis = ["🎩", "💰", "💎", "👑", "♟️", "✨", "🔥", "😹", "🖤"];

  // 🔁 Messages
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;

      const sender = mek.key.remoteJid;
      if (mek.key.fromMe || sender === "status@broadcast") return;

      const senderID = mek.key.participant || mek.key.remoteJid;
      const isFirstTime = !firstDMCache.has(senderID);
      if (isFirstTime) {
        firstDMCache.set(senderID, true);
        await client.sendMessage(senderID, {
          text: "⏳ 𝖒𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖘𝖞𝖓𝖈𝖎𝖓𝖌... 🔁",
        });
      }

      // 👁 Auto view
      if (autoviewstatus === "TRUE" && sender === "status@broadcast") {
        await client.readMessages([mek.key]);
      }

      // ❤️ React to status
      if (autolike === "TRUE" && sender === "status@broadcast") {
        const emoji = statusEmojis[Math.floor(Math.random() * statusEmojis.length)];
        await client.sendMessage(sender, {
          react: { key: mek.key, text: emoji },
        });
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      require("./blacks")(client, m, chatUpdate, store);
    } catch (err) {
      console.error(err);
    }
  });

  // 🛑 AntiForeign
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === "TRUE" && update.action === "add") {
      for (const participant of update.participants) {
        const jid = client.decodeJid(participant);
        const number = jid.split("@")[0];
        if (!number.startsWith(mycode)) {
          await client.sendMessage(update.id, {
            text: `🧾 𝕯𝖎𝖋𝖋𝖊𝖗𝖊𝖓𝖙 𝖈𝖔𝖉𝖊 𝖉𝖊𝖙𝖊𝖈𝖙𝖊𝖉... ⚠️\n𝖒𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖔𝖓 𝖘𝖊𝖈𝖚𝖗𝖎𝖙𝖞 𝖉𝖚𝖙𝖞.`,
            mentions: [jid],
          });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
        }
      }
    }
    Events(client, update);
  });

  // 📞 AntiCall
  client.ev.on("call", async (callData) => {
    if (anticall === "TRUE") {
      const caller = callData[0].from;
      await client.rejectCall(callData[0].id, caller);
      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(caller, {
          text: anticallMsg,
        });
        lastTextTime = now;
      }
    }
  });

  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  client.public = true;
  client.serializeM = (m) => smsg(client, m, store);
  return client;
}

app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`🌐 Server running: http://localhost:${port}`));

startRaven();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`🔁 Reloading ${__filename}`));
  delete require.cache[file];
  require(file);
});