/* 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 - Final index.js Script
   Includes:
   - Gothic Font Responses 🕸️
   - Dynamic Gothic Autobio 🕯️
   - Gothic Startup Message ⚙️
   - First DM Reply (to every new contact) 🔍
   - Autolike on status with Emojis 😹🤝🫰😍👀👌
   - Anticall response: “𝖂𝖊 𝖉𝖔𝖓'𝖙 𝖙𝖆𝖐𝖊 𝖈𝖆𝖑𝖑𝖘. 𝕿𝖊𝖝𝖙, 𝖔𝖗 𝖇𝖊 𝖌𝖔𝖓𝖊. 📵”
   - QR Terminal Disabled
   - Safe error handling
*/

const {
  default: ravenConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidDecode,
  proto,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const pino = require("pino");
const chalk = require("chalk");
const figlet = require("figlet");
const express = require("express");
const { File } = require("megajs");
const FileType = require("file-type");
const PhoneNumber = require("awesome-phonenumber");

const app = express();
const { smsg, getBuffer } = require("./lib/ravenfunc");
const {
  session,
  mode,
  prefix,
  autobio,
  autolike,
  anticall,
  autoviewstatus,
  port,
} = require("./set.js");
const Events = require("./action/events");
const makeInMemoryStore = require("./store/store.js");

const seenContacts = new Set();
let lastTextTime = 0;
const messageDelay = 5000;

const logger = pino({ level: "silent" });
const store = makeInMemoryStore({ logger });

const color = (text, color) => !color ? chalk.green(text) : chalk.keyword(color)(text);

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
        console.log("⏳ Connecting to WhatsApp...");
      });
    });
  }
}

async function startRaven() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + "/sessions/");
  const { version } = await fetchLatestBaileysVersion();

  console.log(color(figlet.textSync("BLACK-MERCHANT", { font: "Standard" }), "green"));

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["Black Merchant", "Safari", "5.1.7"],
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
      await client.sendMessage(client.user.id, {
        text: `🛠️ 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖔𝖓𝖑𝖎𝖓𝖊\n⚙️ 𝕸𝖔𝖉𝖊: ${mode}\n💠 𝕻𝖗𝖊𝖋𝖎𝖝: ${prefix}`,
      });
    }
  });

  client.ev.on("creds.update", saveCreds);

  // Smart Autobio
  if (autobio === "TRUE") {
    const quotes = [
      "𝕿𝖍𝖊 𝕯𝖆𝖗𝖐 𝕸𝖆𝖗𝕶",
      "𝕷𝖊𝖌𝖊𝖓𝖉 𝕲𝖔𝖊𝖘 𝕭𝖞",
      "𝕿𝖎𝖒𝖊𝖑𝖊𝖘𝖘 𝖈𝖔𝖉𝖊𝖗"
    ];
    setInterval(() => {
      const now = new Date();
      const date = now.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" });
      const time = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" });
      const quote = quotes[Math.floor(Math.random() * quotes.length)];
      const status = `📅 ${date} | ${time} 📆\n${quote} - 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙`;
      client.updateProfileStatus(status).catch(() => {});
    }, 10000);
  }

  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;

      const fromJid = mek.key.remoteJid;
      const isPrivate = fromJid.endsWith("@s.whatsapp.net");
      const senderId = mek.key.participant || fromJid;

      if (isPrivate && !mek.key.fromMe && !seenContacts.has(senderId)) {
        await client.sendMessage(fromJid, {
          text: "⚙️ 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖘𝖞𝖓𝖈𝖎𝖓𝖌... 🔄",
        });
        seenContacts.add(senderId);
      }

      if (autoviewstatus === "TRUE" && fromJid === "status@broadcast") {
        await client.readMessages([mek.key]);
      }

      if (autolike === "TRUE" && fromJid === "status@broadcast") {
        const emojiList = ["😹", "🤝", "🫰", "😍", "👀", "👌"];
        const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
        await client.sendMessage(fromJid, {
          react: { key: mek.key, text: emoji },
        });
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      require("./blacks")(client, m, chatUpdate, store);
    } catch (err) {
      console.error("Message handler error:", err);
    }
  });

  client.ev.on("call", async (callData) => {
    if (anticall === "TRUE") {
      const caller = callData[0].from;
      await client.rejectCall(callData[0].id, caller);
      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(caller, {
          text: "📵 𝖂𝖊 𝖉𝖔𝖓'𝖙 𝖙𝖆𝖐𝖊 𝖈𝖆𝖑𝖑𝖘. 𝕿𝖊𝖝𝖙, 𝖔𝖗 𝖇𝖊 𝖌𝖔𝖓𝖊. 📵",
        });
        lastTextTime = now;
        await client.sendMessage(client.user.id, {
          text: `📞 𝕾𝖔𝖒𝖊𝖔𝖓𝖊 𝖈𝖆𝖑𝖑𝖊𝖉 𝖆𝖓𝖉 𝖜𝖆𝖘 𝖇𝖑𝖔𝖈𝖐𝖊𝖉:\n🔹 𝕵𝖎𝖉: ${caller}`,
        });
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

// Express server
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`🌐 Server running at http://localhost:${port}`));

// Start the bot
startRaven();

// Hot reload
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`🔁 Reloading ${__filename}`));
  delete require.cache[file];
  require(file);
});