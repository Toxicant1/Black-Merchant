/* If it works, don't fix it — just make it Beltah 😎 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  proto,
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

const Events = require("./action/events");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require("./lib/ravenexif");
const { smsg, isUrl, getBuffer } = require("./lib/ravenfunc");
const makeInMemoryStore = require("./store/store.js");
const store = makeInMemoryStore({ logger });

let lastTextTime = 0;
const messageDelay = 5000;

const color = (text, clr) => (!clr ? chalk.green(text) : chalk.keyword(clr)(text));

// 🔐 Session Authentication
async function authentication() {
  if (!fs.existsSync(__dirname + "/session/creds.json")) {
    if (!session) return console.log("⚠️ Please add your session to SESSION env !!");
    try {
      const sessData = session.replace("BELTAHBOT;;;", "");
      const decoded = Buffer.from(sessData, "base64");
      fs.writeFileSync(__dirname + "/session/creds.json", decoded);
      console.log("✅ Session file restored successfully.");
      console.log("🔄 Connecting to WhatsApp... please wait");
    } catch (err) {
      console.error("❌ Failed to restore session:", err.message);
    }
  }
}

// 🚀 Start BeltahBot
async function startBeltah() {
  await authentication();
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + "/session/");
  const { version } = await fetchLatestBaileysVersion();

  console.log(color(figlet.textSync("BELTAHBOT", { font: "Standard" }), "green"));

  const client = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["BeltahBot", "Chrome", "1.0"],
    auth: state,
    syncFullHistory: true,
  });

  store.bind(client.ev);
  client.ev.on("creds.update", saveCreds);

  // 🔁 Connection Handling
  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("🧠 Reconnecting Beltah... chill kidogo...");
        setTimeout(() => startBeltah(), 4000);
      } else {
        console.log("😴 Logged out from WhatsApp. Re-run the bot.");
      }
    } else if (connection === "open") {
      console.log(color("🔥 Beltah connected successfully! Tuko live 💪🏾", "green"));
      client.sendMessage(client.user.id, {
        text: `💫 *BELTAHBOT ONLINE!*\n\nMode: ${mode}\nPrefix: ${prefix}\n\n🤖 Powered by Beltah x Knight`,
      });

      // Autobio
      if (autobio === "TRUE") {
        const quotes = [
          "🌙 Vibe safi tu, hakuna stress...",
          "💫 Ukikaa kimya, unaskia peace...",
          "🔥 Mambo iko juu, Beltah anatambaa...",
          "😎 Life ni safari, sio mbio bro...",
        ];
        setInterval(() => {
          const now = new Date();
          const date = now.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi" });
          const time = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi" });
          const quote = quotes[Math.floor(Math.random() * quotes.length)];
          const status = `📅 ${date} | ${time}\n${quote} – Beltah`;
          client.updateProfileStatus(status).catch(() => {});
        }, 15000);
      }
    }
  });

  // 🚫 AntiCall Logic
  client.ev.on("call", async (calls) => {
    if (anticall !== "TRUE") return;
    try {
      for (const call of calls) {
        await client.updateCall(call.id, "reject");
        const now = Date.now();
        if (now - lastTextTime >= messageDelay) {
          await client.sendMessage(call.from, {
            text: `🚫 *Call Alert!*\n\nBro, usinipigie bila kusema kwanza 😅\n\n📵 *Tuma message tu bro, si call center hii.*\n⛔ Ukirudia... block inakuja bila notice.`,
          });
          lastTextTime = now;
        }
      }
    } catch (err) {
      console.error("⚠️ Anticall error:", err.message);
    }
  });

  // 📩 Message Handler
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message =
        Object.keys(mek.message)[0] === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;

      // Auto view status
      if (autoviewstatus === "TRUE" && mek.key.remoteJid === "status@broadcast") {
        client.readMessages([mek.key]);
      }

      // Autolike (React)
      if (autolike === "TRUE" && mek.key.remoteJid === "status@broadcast") {
        try {
          const emojis = ["❤️", "🔥", "💫", "🌟", "😁", "💯", "🥂", "✨"];
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          await client.sendMessage(mek.key.remoteJid, {
            react: { key: mek.key, text: emoji },
          });
          console.log(`💌 [Beltah Sent Reaction] ${emoji}`);
        } catch (err) {
          console.log("❌ Failed to send reaction:", err.message);
        }
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      const m = smsg(client, mek, store);

      // 🔮 AI Stack
      const { default: BeltahAI } = require("./modules/aiHandler");
      await BeltahAI(client, m, store);

      // 🧠 Commands (old blacks.js logic moved modularly)
      const commands = require("./main");
      await commands(client, m, chatUpdate, store);
    } catch (err) {
      console.error("⚠️ Message handler error:", err);
    }
  });

  // 🌍 Anti-Foreign Filter
  client.ev.on("group-participants.update", async (update) => {
    if (antiforeign === "TRUE" && update.action === "add") {
      for (let participant of update.participants) {
        const jid = client.decodeJid(participant);
        const phoneNumber = jid.split("@")[0].replace(/[^0-9]/g, "");
        const code = mycode.replace("+", "");
        if (!phoneNumber.startsWith(code)) {
          await client.sendMessage(update.id, {
            text: "🚫 Sorry bro, your country code haiko allowed hapa!",
            mentions: [jid],
          });
          await client.groupParticipantsUpdate(update.id, [jid], "remove");
          console.log(`❌ Removed ${jid} (foreign code).`);
        }
      }
    }
    Events(client, update);
  });

  return client;
}

// 🌐 Static hosting
app.use(express.static("pixel"));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`🛰️ Server live on http://localhost:${port}`));

// 🏁 Start bot
startBeltah();

// 🔁 Hot reload
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`♻️ File updated: ${__filename}`));
  process.exit(0);
});