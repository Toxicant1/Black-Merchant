// == FULL BLACK MERCHANT BOT SCRIPT ==
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidDecode,
  proto,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const chalk = require("chalk");
const figlet = require("figlet");
const PhoneNumber = require("awesome-phonenumber");
const FileType = require("file-type");
const { smsg, getBuffer, sleep } = require("./lib/ravenfunc");
const {
  autobio,
  autolike,
  autoviewstatus,
  anticall,
  prefix,
  port,
} = require("./set.js");

const express = require("express");
const app = express();
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

let newUsers = new Set();
let lastTextTime = 0;
const messageDelay = 5000;
const seriousFont = (txt) => `𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 ⚔️:\n${txt}`;
const autolikeEmojis = ["😹", "🤝", "🫰", "😍", "👀", "👌"];

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("sessions");
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    auth: state,
    browser: ["𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙", "Chrome", "10.0"],
  });

  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      const startupMsg = `✅ 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 connected 🛸\n⚙️ 𝕸𝖔𝖉𝖊: PUBLIC\n💠 𝕻𝖗𝖊𝖋𝖎𝖝: ${prefix}`;
      await conn.sendMessage(conn.user.id, { text: startupMsg });
    } else if (
      connection === "close" &&
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
    ) {
      startBot();
    }
  });

  conn.ev.on("creds.update", saveCreds);

  // Autobio
  if (autobio === "TRUE") {
    setInterval(async () => {
      try {
        const date = new Date().toLocaleDateString("en-US", {
          timeZone: "Africa/Nairobi",
        });
        const time = new Date().toLocaleTimeString("en-US", {
          timeZone: "Africa/Nairobi",
        });
        const quote = "𝕿𝖍𝖊 𝖜𝖔𝖗𝖑𝖉 𝖇𝖔𝖜𝖘 𝖙𝖔 𝖙𝖍𝖊 𝖉𝖆𝖗𝖐 𝖜𝖍𝖊𝖓 𝖙𝖍𝖊 𝖑𝖎𝖌𝖍𝖙 𝖋𝖆𝖎𝖑𝖘.";
        await conn.updateProfileStatus(
          `⚔️ 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 ⚔️\n📆 ${date} | 📅 ${time}\n🕯️ ${quote}`
        );
      } catch {}
    }, 10 * 1000);
  }

  // Message handler
  conn.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const m = messages[0];
      if (!m.message) return;
      const msgType = Object.keys(m.message)[0];
      const jid = m.key.remoteJid;

      // Autoview status
      if (autoviewstatus === "TRUE" && jid === "status@broadcast") {
        conn.readMessages([m.key]);
      }

      // Autolike
      if (autolike === "TRUE" && jid === "status@broadcast") {
        const emoji =
          autolikeEmojis[Math.floor(Math.random() * autolikeEmojis.length)];
        await conn.sendMessage(jid, {
          react: { key: m.key, text: emoji },
        });
      }

      // Reply to new numbers
      if (
        jid.endsWith("@s.whatsapp.net") &&
        !newUsers.has(jid) &&
        !m.key.fromMe
      ) {
        newUsers.add(jid);
        await conn.sendMessage(jid, {
          text: "𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖘𝖞𝖓𝖈𝖎𝖓𝖌... 🔄",
        });
      }

      // Basic Command
      const text =
        m.message?.conversation ||
        m.message[msgType]?.caption ||
        m.message[msgType]?.text ||
        "";
      if (!text || !text.startsWith(prefix)) return;

      const command = text.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
      if (command === "ping") {
        await conn.sendMessage(jid, {
          text: seriousFont("𝖄𝖊𝖘, 𝖒𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝖎𝖘 𝖆𝖜𝖆𝖐𝖊 ⚡"),
        });
      }
    } catch (err) {
      console.error("Message error:", err);
    }
  });

  // Anticall
  conn.ev.on("call", async (callData) => {
    if (anticall === "TRUE") {
      const callerId = callData[0].from;
      await conn.rejectCall(callData[0].id, callerId);
      const now = Date.now();
      if (now - lastTextTime >= messageDelay) {
        await conn.sendMessage(callerId, {
          text: "𝖂𝖊 𝖉𝖔𝖓'𝖙 𝖙𝖆𝖐𝖊 𝖈𝖆𝖑𝖑𝖘. 𝕿𝖊𝖝𝖙, 𝖔𝖗 𝖇𝖊 𝖌𝖔𝖓𝖊. 📵",
        });
        lastTextTime = now;
      }
    }
  });
}

startBot();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update detected in ${__filename}`));
  delete require.cache[file];
  require(file);
});