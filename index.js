/* If it works, don't Fix it */
const {
  default: ravenConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidDecode,
  proto
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
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/ravenexif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep } = require('./lib/ravenfunc');

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
  const sessionsDir = path.join(__dirname, 'sessions');
  const credsPath = path.join(sessionsDir, 'creds.json');

  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  if (!fs.existsSync(credsPath)) {
    if (!session) return console.log(chalk.red('Please add your session to SESSION env !!'));
    
    const sessdata = session.replace("BLACK MD;;;", '');
    console.log(color("Downloading session from Mega... ⏳️", "yellow"));

    try {
      const filer = await File.fromURL(`https://mega.nz/file/${sessdata}`);
      await new Promise((resolve, reject) => {
        filer.download((err, data) => {
          if (err) return reject(err);
          fs.writeFileSync(credsPath, data);
          resolve();
        });
      });
      console.log(color("Session downloaded successfully ✅️", "green"));
      console.log(color("Connecting to WhatsApp... Hold on ⌚️", "cyan"));
    } catch (e) {
      console.log(chalk.red("Download failed: " + e.message));
    }
  }
}

async function startRaven() {
  await authentication();

  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);

  console.log(color(figlet.textSync("BLACK-MD", { font: "Standard", horizontalLayout: "default", vertivalLayout: "default", whitespaceBreak: false }), "green"));

  const client = ravenConnect({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["BLACK - AI", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);

  // Connection handling
  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log(color(`Connection closed, reconnecting... Status Code: ${statusCode}`, "yellow"));
        startRaven();
      } else {
        console.log(color("Device logged out. Delete sessions folder and scan again.", "red"));
      }
    } else if (connection === 'connecting') {
      console.log(color("Connecting to WhatsApp...", "cyan"));
    } else if (connection === 'open') {
      console.log(color("Congrats, BLACK MD has successfully connected to this server ✅", "green"));
      console.log(color("Follow me on github as Blackie254", "red"));
      console.log(color("Text the bot number with menu to check my command list"));

      try { await client.groupAcceptInvite('LDBdQY8fKbs1qkPWCTuJGX'); } catch {}

      const Texxt = `✅ 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 » »【BLACK MD】\n👥 𝗠𝗼𝗱𝗲 »» ${mode}\n👤 𝗣𝗿𝗲𝗳𝗶𝘅 »» ${prefix}`;
      await client.sendMessage(client.user.id, { text: Texxt });
    }
  });

  client.ev.on("creds.update", saveCreds);

  // Autobio / Status updater
  if (autobio === 'TRUE') {
    setInterval(() => {
      const date = new Date();
      client.updateProfileStatus(`${date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })} It's a ${date.toLocaleString('en-US', { weekday: 'long', timeZone: 'Africa/Nairobi'})}.`);
    }, 10 * 1000);
  }

  // Messages handling
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

      if (autoviewstatus === 'TRUE' && mek.key?.remoteJid === "status@broadcast") client.readMessages([mek.key]);

      if (autolike === 'TRUE' && mek.key?.remoteJid === "status@broadcast") {
        const nickk = await client.decodeJid(client.user.id);
        if (!mek.status) await client.sendMessage(mek.key.remoteJid, { react: { key: mek.key, text: '👻' } }, { statusJidList: [mek.key.participant, nickk] });
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;

      let m = smsg(client, mek, store);
      const raven = require("./blacks");
      raven(client, m, chatUpdate, store);
    } catch (err) { console.log(err); }
  });

  // Anticall
  client.ev.on('call', async (callData) => {
    if (anticall === 'TRUE') {
      const callId = callData[0].id;
      const callerId = callData[0].from;
      await client.rejectCall(callId, callerId);

      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(callerId, { text: "Anticall is active, Only texts are allowed 👻" });
        lastTextTime = now;
      }
    }
  });

  // Antiforeign check
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === 'TRUE' && update.action === "add") {
      for (let participant of update.participants) {
        const jid = client.decodeJid(participant);
        const phoneNumber = jid.split("@")[0];
        if (!phoneNumber.startsWith(mycode)) {
          await client.sendMessage(update.id, { text: "Your Country code is not allowed to join this group !", mentions: [jid] });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
          console.log(`Removed ${jid} from group ${update.id} because they are not from ${mycode}`);
        }
      }
    }
    Events(client, update);
  });

  // Contacts update
  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = client.decodeJid(contact.id);
      if (store?.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  // Decode JID
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  // Get name utility
  client.getName = (jid, withoutContact = false) => {
    const id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us")) return new Promise(async (resolve) => { v = store.contacts[id] || {}; if (!(v.name || v.subject)) v = client.groupMetadata(id) || {}; resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international")); });
    else v = id === "0@s.whatsapp.net" ? { id, name: "WhatsApp" } : id === client.decodeJid(client.user.id) ? client.user : store.contacts[id] || {};
    return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  client.public = true;
  client.serializeM = (m) => smsg(client, m, store);

  // Utility function for fetching buffer
  const getBuffer = async (url, options) => {
    try {
      options ? options : {};
      const res = await axios({ method: "get", url, headers: { DNT: 1, "Upgrade-Insecure-Request": 1 }, ...options, responseType: "arraybuffer" });
      return res.data;
    } catch (err) { return err; }
  };

  // Add media functions (sendImage, sendFile, sendImageAsSticker, sendVideoAsSticker, downloadMediaMessage, downloadAndSaveMediaMessage)
  require('./lib/ravenmedia')(client, getBuffer, packname);

  return client;
}

// Express server
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

// Start bot
startRaven();

// Hot reload
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
