/* If it works, don't Fix it */
const {
  default: ravenConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  proto
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const express = require("express");
const chalk = require("chalk");
const figlet = require("figlet");
const { File } = require("megajs");
const app = express();
const { smsg } = require("./lib/ravenfunc");
const { session, mode, prefix, autobio, autolike, antidelete, port, autoviewstatus } = require("./set.js");
const makeInMemoryStore = require("./store/store.js");
const store = makeInMemoryStore({ logger: pino({ level: "silent" }).child({ stream: "store" }) });

const color = (text, color) => (!color ? chalk.green(text) : chalk.keyword(color)(text));

/* 🧠 Authentication logic */
async function authentication() {
  const sessionDir = path.join(__dirname, "sessions");
  const sessionPath = path.join(sessionDir, "creds.json");

  // ensure folder exists
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  // if creds file missing, create empty
  if (!fs.existsSync(sessionPath)) fs.writeFileSync(sessionPath, "{}");

  if (!session) {
    console.log("❌ No SESSION provided in environment variables!");
    return;
  }

  // Clean the session
  const cleanSession = session.replace("BLACK MD;;;", "").trim();

  // Check if it's a MEGA link or a plain session ID
  if (cleanSession.startsWith("https://mega.nz/file/")) {
    try {
      const file = File.fromURL(cleanSession);
      file.download((err, data) => {
        if (err) throw err;
        fs.writeFile(sessionPath, data, () => {
          console.log("✅ Session downloaded successfully!");
          console.log("⏳ Connecting to WhatsApp... hold on for a few seconds.");
        });
      });
    } catch (err) {
      console.log("❌ Mega session download failed:", err.message);
    }
  } else if (cleanSession.includes("#")) {
    console.log("⚡ Session format detected: Using local ID/key pair.");
    fs.writeFileSync(sessionPath, cleanSession);
  } else {
    console.log("⚠️ Invalid session format — please provide a valid session string or Mega link.");
  }
}

/* 🚀 Start the bot */
async function startRaven() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "sessions"));
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Using WA v${version.join(".")}, latest: ${isLatest}`);
  console.log(color(figlet.textSync("BLACK MERCHANT", { font: "Standard" }), "green"));

  const client = ravenConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Black Merchant", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);

  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startRaven();
    } else if (connection === "open") {
      console.log(color("🔥 BLACK MERCHANT connected successfully!", "green"));
      console.log(color("💀 Type 'menu' to see commands.", "cyan"));
      const text = `✅ 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱\n👥 𝗠𝗼𝗱𝗲 » ${mode}\n👤 𝗣𝗿𝗲𝗳𝗶𝘅 » ${prefix}`;
      client.sendMessage(client.user.id, { text });
    }
  });

  client.ev.on("creds.update", saveCreds);

  /* 🖤 Auto Bio Rotator */
  if (autobio === "TRUE") {
    const bios = [
      "💀 𝕿𝖍𝖊 𝕭𝖑𝖆𝖈𝖐 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 👻",
      "😇 𝕯𝖆𝖗𝖐 𝕾𝖔𝖚𝖑𝖘, 𝕷𝖎𝖌𝖍𝖙 𝕸𝖎𝖓𝖉 🦋",
      "🦝 𝕮𝖔𝖉𝖊 𝖎𝖓 𝕯𝖆𝖗𝖐, 𝕾𝖕𝖊𝖆𝖐 𝖎𝖓 𝕷𝖎𝖌𝖍𝖙 ♨️",
      "🐺 𝕸𝖊𝖗𝖈𝖍𝖆𝖓𝖙 𝕺𝖋 𝕭𝖑𝖆𝖈𝖐 𝕸𝖆𝖌𝖎𝖈 ❤️‍🔥",
      "🦊 𝕯𝖊𝖆𝖙𝖍 𝕚𝖘 𝕹𝖔𝖙 𝕿𝖍𝖊 𝕰𝖓𝖉 🍭",
    ];
    let index = 0;
    setInterval(() => {
      client.updateProfileStatus(bios[index]);
      index = (index + 1) % bios.length;
    }, 30 * 60 * 1000);
  }

  /* 💥 Auto Like Status */
  if (autolike === "TRUE") {
    client.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        let mek = chatUpdate.messages[0];
        if (!mek.message) return;
        if (mek.key && mek.key.remoteJid === "status@broadcast") {
          const emojis = ['😍','😇','😊','👻','💀','❤️‍🔥','❤️‍🩹','💥','🤞','🫰','👀','🦝','🐺','🦊','🐀','🐁','🦋','🫛','🍭','♨️'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          await client.sendMessage(mek.key.remoteJid, {
            react: { key: mek.key, text: randomEmoji }
          });
          console.log(`Reacted to status with ${randomEmoji}`);
        }
      } catch (err) {
        console.log(err);
      }
    });
  }

  /* 🕵️ Anti-Delete */
  if (antidelete === "TRUE") {
    client.ev.on("message.delete", async (deleted) => {
      try {
        const key = deleted.keys[0];
        const jid = key.remoteJid;
        if (!jid || key.fromMe) return;
        const deletedMsg = store.loadMessage(jid, key.id);
        if (!deletedMsg) return;
        const caption = deletedMsg.message?.conversation || deletedMsg.message?.extendedTextMessage?.text || "";
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

  /* 🧠 Message Handler */
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = mek.message.ephemeralMessage?.message || mek.message;
      if (autoviewstatus === "TRUE" && mek.key.remoteJid === "status@broadcast") {
        client.readMessages([mek.key]);
      }
      let m = smsg(client, mek, store);
      const raven = require("./blacks");
      raven(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  /* Error handlers */
  process.on("unhandledRejection", (reason) => console.log("Unhandled:", reason));
  process.on("rejectionHandled", () => console.log("Rejection handled"));

  return client;
}

/* 🌐 Express Server */
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

startRaven();