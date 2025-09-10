/* 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 - Updated index.js  
   ⛓️ If it works, don’t fix it ⛓️  
*/

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
const path = require('path');
const axios = require("axios");
const express = require("express");
const chalk = require("chalk");
const FileType = require("file-type");
const figlet = require("figlet");
const { File } = require('megajs');
const app = express();
const _ = require("lodash");
let lastTextTime = 0;
const messageDelay = 5000;
const Events = require('./action/events');
const logger = pino({ level: 'silent' });
const PhoneNumber = require("awesome-phonenumber");

const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid
} = require('./lib/ravenexif');

const {
  smsg,
  isUrl,
  generateMessageTag,
  getBuffer,
  getSizeMedia,
  fetchJson,
  await,
  sleep
} = require('./lib/ravenfunc');

const {
  sessionName,
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
  autoviewstatus
} = require("./set.js");

const makeInMemoryStore = require('./store/store.js');
const store = makeInMemoryStore({ logger: logger.child({ stream: 'store' }) });

const color = (text, color) => !color ? chalk.green(text) : chalk.keyword(color)(text);

async function authentication() {
  if (!fs.existsSync(__dirname + '/sessions/creds.json')) {
    if (!session) return console.log('Please add your session to SESSION env !!');
    const sessdata = session.replace("BLACK MD;;;", '');
    const filer = await File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
      if (err) throw err;
      fs.writeFile(__dirname + '/sessions/creds.json', data, () => {
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

  // 🔁 Gothic Autobio with Quotes
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
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage"
        ? mek.message.ephemeralMessage.message
        : mek.message;

      if (autoviewstatus === 'TRUE' && mek.key.remoteJid === "status@broadcast") {
        client.readMessages([mek.key]);
      }

      if (autolike === "TRUE" && mek.key.remoteJid === "status@broadcast") {
        const emojiList = ["😹", "🤝", "🫰", "😍", "👀", "👌"];
        const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
        await client.sendMessage(mek.key.remoteJid, {
          react: { key: mek.key, text: emoji }
        });
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      const raven = require("./blacks");
      raven(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  // ☎️ Anticall (Gothic Style)
  client.ev.on("call", async (callData) => {
    if (anticall === "TRUE") {
      const caller = callData[0].from;
      await client.rejectCall(callData[0].id, caller);
      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(caller, {
          text: "📵 𝖙𝖍𝖎𝖘 𝖆𝖎𝖓’𝖙 𝖆 𝖈𝖆𝖑𝖑 𝖈𝖊𝖓𝖙𝖊𝖗. 𝖀𝖘𝖊 𝖜𝖔𝖗𝖉𝖘. 𝖀𝖘𝖊 𝖙𝖊𝖝𝖙. 📵"
        });
        lastTextTime = now;
        await client.sendMessage(client.user.id, {
          text: `📞 𝕾𝖔𝖒𝖊𝖔𝖓𝖊 𝖈𝖆𝖑𝖑𝖊𝖉 𝖆𝖓𝖉 𝖜𝖆𝖘 𝖇𝖑𝖔𝖈𝖐𝖊𝖉:\n🔹 𝕵𝖎𝖉: ${caller}`
        });
      }
    }
  });
}

app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

startRaven();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});