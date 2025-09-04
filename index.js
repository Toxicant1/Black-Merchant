/* If it works, don't Fix it */
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

const color = (text, color) =>
  !color ? chalk.green(text) : chalk.keyword(color)(text);

const seenContacts = new Set();

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
      client.groupAcceptInvite("L4gDFUFkHmD9NNa2XvVbNj");
      await client.sendMessage(client.user.id, {
        text: `🛠️ 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖔𝖓𝖑𝖎𝖓𝖊\n⚙️ 𝕸𝖔𝖉𝖊: ${mode}\n💠 𝕻𝖗𝖊𝖋𝖎𝖝: ${prefix}`,
      });
    }
  });

  client.ev.on("creds.update", saveCreds);

  // Auto Bio
  if (autobio === "TRUE") {
    const phrases = ["Black Ops", "Bot Hustle", "Gang Links", "Silent Storm", "Elite Sync"];
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
      const status = `${emoji} 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 | ${phrase} | ${formatted}`;
      client.updateProfileStatus(status).catch(console.error);
    }, 10 * 1000);
  }

  const statusEmojis = ["🎩", "💰", "💎", "👑", "♟️", "✨", "🔥", "😹", "🖤"];

  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;

      const fromJid = mek.key.remoteJid;
      const isPrivateChat = fromJid.endsWith("@s.whatsapp.net");
      const senderId = mek.key.participant || fromJid;

      // First DM Gothic auto-reply
      if (
        isPrivateChat &&
        !mek.key.fromMe &&
        !seenContacts.has(senderId)
      ) {
        await client.sendMessage(fromJid, {
          text: "⚙️ 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖘𝖞𝖓𝖈𝖎𝖓𝖌... 🔍",
        });
        seenContacts.add(senderId);
      }

      if (autoviewstatus === "TRUE" && fromJid === "status@broadcast") {
        await client.readMessages([mek.key]);
      }

      if (autolike === "TRUE" && fromJid === "status@broadcast") {
        const myJid = await client.decodeJid(client.user.id);
        const emoji = statusEmojis[Math.floor(Math.random() * statusEmojis.length)];
        await client.sendMessage(fromJid, {
          react: { key: mek.key, text: emoji },
        }, { statusJidList: [mek.key.participant, myJid] });
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      require("./blacks")(client, m, chatUpdate, store);
    } catch (err) {
      console.error(err);
    }
  });

  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === "TRUE" && update.action === "add") {
      for (const participant of update.participants) {
        const jid = client.decodeJid(participant);
        const number = jid.split("@")[0];
        if (!number.startsWith(mycode)) {
          await client.sendMessage(update.id, {
            text: `🚷 𝕳𝖊𝖞! 𝖂𝖗𝖔𝖓𝖌 𝖘𝖙𝖗𝖊𝖊𝖙, 𝖋𝖆𝖒.\nThis spot is for local crew only. 🧊`,
            mentions: [jid],
          });
          await client.groupParticipantsUpdate(update.id, [jid], "remove").catch(() => {});
        }
      }
    }
    Events(client, update);
  });

  client.ev.on("call", async (callData) => {
    if (anticall === "TRUE") {
      const caller = callData[0].from;
      await client.rejectCall(callData[0].id, caller);
      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(caller, {
          text: "☎️🚫 𝕿𝖍𝖎𝖘 𝖆𝖎𝖓’𝖙 𝖆 𝖈𝖆𝖑𝖑 𝖈𝖊𝖓𝖙𝖊𝖗. 𝖀𝖘𝖊 𝖜𝖔𝖗𝖉𝖘. 𝖀𝖘𝖊 𝖙𝖊𝖝𝖙.",
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
app.listen(port, () =>
  console.log(`🌐 Server ready at http://localhost:${port}`)
);

startRaven();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`🔁 Reloading ${__filename}`));
  delete require.cache[file];
  require(file);
});