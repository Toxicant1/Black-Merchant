/* If it works, don't fix it */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const express = require("express");
const chalk = require("chalk");
const pino = require("pino");
const figlet = require("figlet");
const FileType = require("file-type");
const _ = require("lodash");
const { File } = require('megajs');
const PhoneNumber = require("awesome-phonenumber");
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

const Events = require('./action/events');
// const authentication = require('./action/auth'); // Disabled if session is handled inline
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
  autoviewstatus,
} = require("./set.js");

const makeInMemoryStore = require('./store/store.js');
const store = makeInMemoryStore({ logger: pino({ level: "silent" }).child({ stream: "store" }) });

const app = express();
let lastTextTime = 0;
const messageDelay = 5000;

const color = (text, color) => !color ? chalk.green(text) : chalk.keyword(color)(text);

// Session authentication
async function authentication() {
  const credsPath = __dirname + '/sessions/creds.json';
  if (!fs.existsSync(credsPath)) {
    if (!session) return console.log('Please add your session to SESSION env !!');
    const sessdata = session.replace("BLACK MD;;;", '');
    const file = await File.fromURL(`https://mega.nz/file/${sessdata}`);
    file.download((err, data) => {
      if (err) throw err;
      fs.writeFile(credsPath, data, () => {
        console.log("✅ Session downloaded successfully");
        console.log("⏳ Connecting to WhatsApp, Hold on for 3 minutes...");
      });
    });
  }
}

async function startRaven() {
  await authentication();

  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/');
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(color(figlet.textSync("BLACK-MD", { font: "Standard" }), "green"));

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["BLACK - AI", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);

  // Connection updates
  client.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        startRaven();
      }
    } else if (connection === 'open') {
      console.log(color("✅ BLACK MD has successfully connected", "green"));
      console.log(color("📌 Follow on github: Blackie254", "red"));
      client.groupAcceptInvite('L4gDFUFkHmD9NNa2XvVbNj');
      client.sendMessage(client.user.id, {
        text: `✅ 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 » »【BLACK MD】\n👥 𝗠𝗼𝗱𝗲 »» ${mode}\n👤 𝗣𝗿𝗲𝗳𝗶𝘅 »» ${prefix}`
      });
    }
  });

  client.ev.on("creds.update", saveCreds);

  // Auto Bio
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

  // Message handler
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message?.ephemeralMessage?.message || mek.message;

      if (autoviewstatus === 'TRUE' && mek.key?.remoteJid === "status@broadcast") {
        client.readMessages([mek.key]);
      }

      if (autolike === 'TRUE' && mek.key?.remoteJid === "status@broadcast") {
        const nickk = await client.decodeJid(client.user.id);
        if (!mek.status) {
          await client.sendMessage(mek.key.remoteJid, {
            react: { key: mek.key, text: '🐀' }
          }, {
            statusJidList: [mek.key.participant, nickk]
          });
        }
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      require("./blacks")(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  // Handle unhandled promise errors
  process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled Rejection:", reason);
  });

  // Decode JID fix
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  // Contact updates
  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      const id = client.decodeJid(contact.id);
      if (store?.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  // Anti foreign
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === 'TRUE' && update.action === "add") {
      for (let participant of update.participants) {
        const jid = client.decodeJid(participant);
        const phone = jid.split("@")[0];
        if (!phone.startsWith(mycode)) {
          await client.sendMessage(update.id, { text: "", mentions: [jid] });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
          console.log(`Removed ${jid} from ${update.id} (foreign number)`);
        }
      }
    }
    Events(client, update);
  });

  // Anti call
  client.ev.on('call', async (callData) => {
    if (anticall === 'TRUE') {
      const { id: callId, from: callerId } = callData[0];
      await client.rejectCall(callId, callerId);
      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(callerId, {
          text: "⚠️This isn't a call center⚠️. Please send a message instead. Calls are not accepted."
        });
        lastTextTime = now;
      }
    }
  });

  // Add your helper functions (getBuffer, sendFile, sendSticker, etc.) below this point...

  client.public = true;
  client.serializeM = (m) => smsg(client, m, store);

  return client;
}

// Start Express server
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

// Start the bot
startRaven();

// Hot reload
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});