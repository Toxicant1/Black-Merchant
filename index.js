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
const chalk = require("chalk");
const figlet = require("figlet");
const express = require("express");
const axios = require("axios");
const FileType = require("file-type");
const PhoneNumber = require("awesome-phonenumber");

const app = express();
const logger = pino({ level: "silent" });
const { sessionName, session, mode, prefix, autobio, autolike, port, mycode, anticall, antiforeign, packname, autoviewstatus } = require("./set.js");
const Events = require("./action/events");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require("./lib/ravenexif");
const { smsg, isUrl, getBuffer } = require("./lib/ravenfunc");
const makeInMemoryStore = require("./store/store.js");
const store = makeInMemoryStore({ logger });

let lastTextTime = 0;
const messageDelay = 5000;

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

async function authentication() {
  if (!fs.existsSync(__dirname + '/sessions/creds.json')) {
    if (!session) return console.log('Please add your session to SESSION env !!');
    const sessdata = session.replace("BLACK MD;;;", '');
    const { File } = require('megajs');
    const filer = await File.fromURL(`https://mega.nz/file/${sessdata}`);
    filer.download((err, data) => {
      if (err) throw err;
      fs.writeFile(__dirname + '/sessions/creds.json', data, () => {
        console.log("âœ… Session downloaded successfully");
        console.log("â³ Connecting to WhatsApp... please wait");
      });
    });
  }
}

async function startRaven() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/sessions/');
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(color(figlet.textSync("BLACKBOT", { font: "Standard" }), "green"));

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["BlackBot", "Safari", "1.0"],
    auth: state,
    syncFullHistory: true
  });

  store.bind(client.ev);

  client.ev.on("creds.update", saveCreds);

  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close" && (!lastDisconnect || lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut)) {
      console.log("ðŸ” Reconnecting...");
      startRaven();
    } else if (connection === "open") {
      console.log(color("âœ… BlackBot connected successfully!", "green"));
      client.sendMessage(client.user.id, {
        text: `ðŸ”— ð‘ªð’ð’ð’ð’†ð’„ð’•ð’Šð’ð’ ð‘¨ð’„ð’•ð’Šð’—ð’‚ð’•ð’†ð’….
ðŸ¤– ð‘©ð’ð’‚ð’„ð’Œð‘©ð’ð’• ð’Šð’” ð’ð’Šð’—ð’†.
âš™ï¸ ð‘´ð’ð’…ð’† Â»Â» ${mode}
âœ’ï¸ ð‘·ð’“ð’†ð’‡ð’Šð’™ Â»Â» ${prefix}`
      });

      // Autobio
      if (autobio === "TRUE") {
        const quotes = [
          "ð‘¾ð’‚ð’•ð’„ð’‰ð’Šð’ð’ˆ ð’˜ð’Šð’•ð’‰ ð’„ð’‚ð’“ð’†â€¦",
          "ð‘»ð’‰ð’† ð‘©ð’ð’• ð’…ð’ð’†ð’” ð’ð’ð’• ð’”ð’ð’†ð’†ð’‘.",
          "ð‘»ð’‰ð’ð’–ð’ˆð’‰ð’•ð’” ð’Šð’ ð’•ð’‰ð’† ð’…ð’‚ð’“ð’Œ.",
          "ð‘©ð’ð’‚ð’„ð’Œð‘©ð’ð’• ð’Šð’” ð’˜ð’‚ð’•ð’„ð’‰ð’Šð’ð’ˆ. ðŸ‘ï¸"
        ];
        setInterval(() => {
          const now = new Date();
          const date = now.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" });
          const time = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" });
          const quote = quotes[Math.floor(Math.random() * quotes.length)];
          const status = `ðŸ“… ${date} | ${time} ðŸ“†
${quote} â€“ ð‘©ð’ð’‚ð’„ð’Œð‘©ð’ð’•`;
          client.updateProfileStatus(status).catch(() => {});
        }, 10000);
      }
    }
  });

  // Anticall logic
  client.ev.on("call", async (callData) => {
    if (anticall === "TRUE") {
      const callId = callData[0].id;
      const callerId = callData[0].from;
      await client.rejectCall(callId, callerId).catch(() => {});

      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await client.sendMessage(callerId, {
          text:
            "âš ï¸ *If you ever need to call, tell me first.* No permission, no call. ðŸ“²

" +
            "ðŸ“µ *Umejaribu kupiga simu?* âŒ
" +
            "*Hii si call center.* Tuma ujumbe. ðŸ’¬

" +
            "â›” *Ukirudia, block inakuja bila huruma.* ðŸš«"
        });
        lastTextTime = now;
      }
    }
  });

  // Other core events
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

      // Autoview status
      if (autoviewstatus === 'TRUE' && mek.key.remoteJid === "status@broadcast") {
        client.readMessages([mek.key]);
      }

      // Autolike reactions
      if (autolike === 'TRUE' && mek.key.remoteJid === "status@broadcast") {
        try {
          const emojiList = ['â¤ï¸', 'ðŸŒŸ', 'ðŸ«¶', 'ðŸ¥€', 'ðŸ˜Š', 'ðŸŒ¹', 'ðŸ¥°', 'ðŸ’•', 'âœ¨'];
          const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
          const nickk = await client.decodeJid(client.user.id);

          await client.sendMessage(mek.key.remoteJid, {
            react: { key: mek.key, text: emoji }
          }, {
            statusJidList: [mek.key.participant || mek.key.remoteJid, nickk || client.user.id]
          });

          console.log(`ðŸ’– [BlackBot Sent] ${emoji}`);
        } catch (err) {
          console.log("âŒ Failed to send reaction:", err.message);
        }
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      let m = smsg(client, mek, store);
      const raven = require("./blacks");
      raven(client, m, chatUpdate, store);
    } catch (err) {
      console.log("âš ï¸ Message handler error:", err.message);
    }
  });

  // Anti-foreign logic
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === "TRUE" && update.action === "add") {
      for (let participant of update.participants) {
        const jid = client.decodeJid(participant);
        const phoneNumber = jid.split("@")[0];
        if (!phoneNumber.startsWith(mycode)) {
          await client.sendMessage(update.id, {
            text: "âš ï¸ Your Country code is not allowed to join this group!",
            mentions: [jid]
          });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
          console.log(`Removed ${jid} for invalid code.`);
        }
      }
    }
    Events(client, update);
  });

  return client;
}

// Static hosting for menu
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`ðŸŸ¢ Server listening on http://localhost:${port}`));

// Start bot
startRaven();

// Hot reload
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`File updated: ${__filename}`));
  delete require.cache[file];
  require(file);
});