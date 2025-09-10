/* 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 - Updated index.js  
   🛡️ "If it works, don't fix it" */

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

const Events = require('./action/events');
const logger = pino({ level: 'silent' });
const PhoneNumber = require("awesome-phonenumber");
const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
} = require('./lib/ravenexif');
const {
  smsg,
  isUrl,
  generateMessageTag,
  getBuffer,
  getSizeMedia,
  fetchJson,
  await,
  sleep,
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
  autoviewstatus,
} = require("./set.js");

const makeInMemoryStore = require('./store/store.js');
const store = makeInMemoryStore({ logger: logger.child({ stream: 'store' }) });

const color = (text, color) => (!color ? chalk.green(text) : chalk.keyword(color)(text));

// ⛓️ MEGA Session Auth
async function authentication() {
  const credsPath = path.join(__dirname, '/sessions/creds.json');
  if (!fs.existsSync(credsPath)) {
    if (!session) return console.log('Please add your session to SESSION env !!');
    const sessdata = session.replace("BLACK MD;;;", '');
    const file = await File.fromURL(`https://mega.nz/file/${sessdata}`);
    file.download((err, data) => {
      if (err) throw err;
      fs.writeFile(credsPath, data, () => {
        console.log("Session downloaded successfully ✅️");
        console.log("Connecting to WhatsApp ⏳️, Hold on for 3 minutes⌚️");
      });
    });
  }
}

async function startRaven() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '/sessions/'));
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(
    color(
      figlet.textSync("BLACK-MD", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default",
        whitespaceBreak: false,
      }),
      "green"
    )
  );

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["BLACK - AI", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);

  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        startRaven();
      }
    } else if (connection === "open") {
      console.log(color("✅ 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 connected 🛸", "green"));
      await client.sendMessage(client.user.id, {
        text: `🛠️ 𝖔𝖓𝖑𝖎𝖓𝖊\n⚙️ 𝕸𝖔𝖉𝖊: ${mode}\n💠 𝕻𝖗𝖊𝖋𝖎𝖝: ${prefix}`,
      });

      client.ev.on("creds.update", saveCreds);

      // 🧠 Smart Autobio
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
    }
  });

  // 📨 New Message Handler
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;

      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage"
        ? mek.message.ephemeralMessage.message
        : mek.message;

      // Autoview & Autolike
      if (autoviewstatus === 'TRUE' && mek.key?.remoteJid === "status@broadcast") {
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

  // 🔒 Safe Error Handling
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function (err) {
    console.log("Caught exception: ", err);
  });

  // 🔓 Decode JID
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
  };

  // 👤 Contact Update
  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = client.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  // 🛡️ Antiforeign
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === 'TRUE' && update.action === "add") {
      for (let participant of update.participants) {
        const jid = client.decodeJid(participant);
        const phoneNumber = jid.split("@")[0];
        if (!phoneNumber.startsWith(mycode)) {
          await client.sendMessage(update.id, {
            text: "Your Country code is not allowed to join this group!",
            mentions: [jid]
          });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
          console.log(`Removed ${jid} from group ${update.id} due to foreign code.`);
        }
      }
    }
    Events(client, update);
  });

  // 📵 Anticall
  client.ev.on('call', async (callData) => {
    if (anticall === 'TRUE') {
      const callId = callData[0].id;
      const callerId = callData[0].from;
      await client.rejectCall(callId, callerId);
      const currentTime = Date.now();
      if (currentTime - lastTextTime >= messageDelay) {
        await client.sendMessage(callerId, {
  text: "⚠️This isn't a call center⚠️. Please send a message instead. Calls are not accepted."
});
        lastTextTime = currentTime;
      } else {
        console.log('Message skipped to prevent overflow');
      }
    }
  });

  // 🧠 Helpers
  client.getName = (jid, withoutContact = false) => {
    let id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = await client.groupMetadata(id) || {};
        resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
      });
    else {
      v = id === "0@s.whatsapp.net"
        ? { id, name: "WhatsApp" }
        : id === client.decodeJid(client.user.id)
          ? client.user
          : store.contacts[id] || {};
    }
    return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  // 🧾 Set Status
  client.setStatus = (status) => {
    client.query({
      tag: "iq",
      attrs: { to: "@s.whatsapp.net", type: "set", xmlns: "status" },
      content: [{ tag: "status", attrs: {}, content: Buffer.from(status, "utf-8") }],
    });
    return status;
  };

  client.public = true;
  client.serializeM = (m) => smsg(client, m, store);
  return client;
}

// 🌐 Server Start
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

// 🚀 Start Bot
startRaven();

// 🔁 Auto Reload
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});