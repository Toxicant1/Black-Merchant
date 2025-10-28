/* If it works, don't  Fix it */
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
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/ravenexif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep } = require('./lib/ravenfunc');
const { sessionName, session, mode, prefix, autobio, autolike, antidelete, port, mycode, anticall, antiforeign, packname, autoviewstatus } = require("./set.js");
const makeInMemoryStore = require('./store/store.js'); 
const store = makeInMemoryStore({ logger: logger.child({ stream: 'store' }) });

const color = (text, color) => !color ? chalk.green(text) : chalk.keyword(color)(text);

async function authentication() {
  if (!fs.existsSync(__dirname + '/sessions/creds.json')) {
    if(!session) return console.log('Please add your session to SESSION env !!');
    const sessdata = session.replace("BLACK MD;;;", '');
    const filer = await File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
      if(err) throw err;
      fs.writeFile(__dirname + '/sessions/creds.json', data, () => {
        console.log("Session downloaded successfully✅️");
        console.log("Connecting to WhatsApp ⏳️, Hold on for 3 minutes⌚️");
      });
    });
  }
}

async function startRaven() {
  await authentication();  
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/');
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(color(figlet.textSync("BLACK MERCHANT", { font: "Standard" }), "green"));

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Black Merchant", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);

  client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) startRaven();
    } else if (connection === 'open') {
      console.log(color("🔥 Black Merchant connected successfully to WhatsApp!", "green"));
      console.log(color("👑 Follow @Blackie254 on GitHub", "red"));
      console.log(color("💀 Type 'menu' to see commands", "cyan"));
      const text = `✅ 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 » »【BLACK MERCHANT】\n👥 𝗠𝗼𝗱𝗲 »» ${mode}\n👤 𝗣𝗿𝗲𝗳𝗶𝘅 »» ${prefix}`;
      client.sendMessage(client.user.id, { text });
    }
  });

  client.ev.on("creds.update", saveCreds);

  /* 🖤 GOTHIC AUTO BIO ROTATOR */
  if (autobio === 'TRUE') {
    const gothicBios = [
      "💀 𝕿𝖍𝖊 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 👻",
      "😇 𝕯𝖆𝖗𝖐 𝕾𝖔𝖚𝖑𝖘, 𝕷𝖎𝖌𝖍𝖙 𝕸𝖎𝖓𝖉 🦋",
      "🦝 𝕮𝖔𝖉𝖊 𝖎𝖓 𝕯𝖆𝖗𝖐, 𝕾𝖕𝖊𝖆𝖐 𝖎𝖓 𝕷𝖎𝖌𝖍𝖙 ♨️",
      "🐺 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝕺𝖋 𝕭𝖑𝖆𝖈𝖐 𝕸𝖆𝖌𝖎𝖈 ❤️‍🔥",
      "🦊 𝕯𝖊𝖆𝖙𝖍 𝕚𝖘 𝕹𝖔𝖙 𝕿𝖍𝖊 𝕰𝖓𝖉 🍭"
    ];
    let index = 0;
    setInterval(() => {
      client.updateProfileStatus(gothicBios[index]);
      index = (index + 1) % gothicBios.length;
    }, 30 * 60 * 1000); // every 30 minutes
  }

  /* 💥 AUTO LIKE STATUSES WITH ROTATING EMOJIS */
  if (autolike === 'TRUE') {
    client.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        let mek = chatUpdate.messages[0];
        if (!mek.message) return;
        if (mek.key && mek.key.remoteJid === "status@broadcast") {
          const emojiList = ['😍','😇','😊','👻','💀','❤️‍🔥','❤️‍🩹','💥','🤞','🫰','👀','🦝','🐺','🦊','🐀','🐁','🦋','🫛','🍭','♨️'];
          const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
          await client.sendMessage(mek.key.remoteJid, {
            react: { key: mek.key, text: randomEmoji }
          });
          console.log(`Reacted to status with ${randomEmoji}`);
        }
      } catch (err) { console.log(err); }
    });
  }

  /* 👀 ANTI-DELETE HANDLER */
  if (antidelete === 'TRUE') {
    client.ev.on('message.delete', async (deleted) => {
      try {
        const key = deleted.keys[0];
        const jid = key.remoteJid;
        if (!jid || key.fromMe) return;

        const deletedMsg = store.loadMessage(jid, key.id);
        if (!deletedMsg) return;

        const caption = deletedMsg.message?.conversation || deletedMsg.message?.extendedTextMessage?.text || '';
        const sender = key.participant || key.remoteJid;

        await client.sendMessage(jid, {
          text: `👀 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖘𝖆𝖜 𝖜𝖍𝖆𝖙 𝖞𝖔𝖚 𝖉𝖊𝖑𝖊𝖙𝖊𝖉 💀\n\n🫰 *Deleted Message:* ${caption}`,
          mentions: [sender],
        });
      } catch (err) {
        console.log("Anti-delete error:", err);
      }
    });
  }

  /* 🧠 MAIN MESSAGE HANDLER */
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;

      if (autoviewstatus === 'TRUE' && mek.key && mek.key.remoteJid === "status@broadcast") {
        client.readMessages([mek.key]);
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      const raven = require("./blacks");
      raven(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  /* ERROR HANDLERS */
  process.on("unhandledRejection", (reason, promise) => console.log("Unhandled:", reason));
  process.on("rejectionHandled", (promise) => console.log("Rejection handled"));
  process.on("Something went wrong", (err) => console.log("Caught exception:", err));

  client.decodeJid = (jid) => !jid ? jid : (/:\d+@/gi.test(jid) ? (jidDecode(jid)?.user + "@" + jidDecode(jid)?.server) : jid);

  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = client.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  /* END OF CORE CONFIG */
  return client;
}

app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

startRaven();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});