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

// New contacts cache
const greetedContacts = new Set();

// Download session if needed
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
      const startText = `✅ 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖔𝖓𝖑𝖎𝖓𝖊 🧠\n🧩 𝖕𝖗𝖊𝖋𝖎𝖝: ${prefix || "none"}\n🎮 𝖒𝖔𝖉𝖊: ${mode}`;
      await client.sendMessage(client.user.id, { text: startText });
    }
  });

  client.ev.on("creds.update", saveCreds);

  // Auto Bio Update
  if (autobio === "TRUE") {
    const phrases = ["Black Power", "Bot Life", "No Mercy", "Synced 🔁", "In Control"];
    const emojis = ["🖤", "⚔️", "🕶️", "👑", "🔧", "🧠", "💼"];
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
    }, 10000);
  }

  const gothic = (text) => {
    const map = {
      A: "𝕬", B: "𝕭", C: "ℭ", D: "𝕯", E: "𝕰", F: "𝕱", G: "𝕲",
      H: "𝕳", I: "𝕴", J: "𝕵", K: "𝕶", L: "𝕷", M: "𝕸", N: "𝕹",
      O: "𝕺", P: "𝕻", Q: "𝕼", R: "𝕽", S: "𝕾", T: "𝕿", U: "𝖀",
      V: "𝖁", W: "𝖂", X: "𝖃", Y: "𝖄", Z: "𝖅",
      a: "𝖆", b: "𝖇", c: "𝖈", d: "𝖉", e: "𝖊", f: "𝖋", g: "𝖌",
      h: "𝖍", i: "𝖎", j: "𝖏", k: "𝖐", l: "𝖑", m: "𝖒", n: "𝖓",
      o: "𝖔", p: "𝖕", q: "𝖖", r: "𝖗", s: "𝖘", t: "𝖙", u: "𝖚",
      v: "𝖛", w: "𝖜", x: "𝖝", y: "𝖞", z: "𝖟",
    };
    return text.split("").map(char => map[char] || char).join("");
  };

  const statusEmojis = ["🎩", "💰", "💎", "👑", "♟️", "✨", "🔥", "🖤"];

  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;

      const from = mek.key.remoteJid;
      const isNewDM = from.endsWith("@s.whatsapp.net") && !greetedContacts.has(from);

      if (isNewDM) {
        greetedContacts.add(from);
        await client.sendMessage(from, {
          text: "⚙️ 𝖒𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖘𝖞𝖓𝖈𝖎𝖓𝖌... 🔁",
        });
      }

      // Auto view + like status
      if (autoviewstatus === "TRUE" && from === "status@broadcast") {
        await client.readMessages([mek.key]);
      }

      if (autolike === "TRUE" && from === "status@broadcast") {
        const emoji = statusEmojis[Math.floor(Math.random() * statusEmojis.length)];
        await client.sendMessage(from, {
          react: { key: mek.key, text: emoji },
        });
      }

      let m = smsg(client, mek, store);
      m.botReply = (txt) => client.sendMessage(m.chat, { text: gothic(txt) }, { quoted: m });
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
            text: `🚫 𝖊𝖞𝖞, 𝖋𝖔𝖗𝖊𝖎𝖌𝖓 𝖓𝖚𝖒𝖇𝖊𝖗 𝖕𝖚𝖑𝖑𝖊𝖉 𝖚𝖕 🔫`,
            mentions: [jid],
          });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
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
          text: "📴 𝖙𝖍𝖎𝖘 𝖆𝖎𝖓'𝖙 𝖆 𝖈𝖆𝖑𝖑 𝖈𝖊𝖓𝖙𝖊𝖗. 𝖚𝖘𝖊 𝖜𝖔𝖗𝖉𝖘. 𝖚𝖘𝖊 𝖙𝖊𝖝𝖙. 💬",
        });
        lastTextTime = now;
      }
    }
  });
}

app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`🌐 Server ready at http://localhost:${port}`));

startRaven();