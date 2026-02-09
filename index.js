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
const { sessionName, session, mode, prefix, autobio, autolike, port, mycode, anticall, antiforeign, packname, autoviewstatus } = require("./set.js");
const makeInMemoryStore = require('./store/store.js');
const store = makeInMemoryStore({ logger: logger.child({ stream: 'store' }) });

const color = (text, color) => {
    return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

async function authentication() {
    if (!fs.existsSync(__dirname + '/sessions/creds.json')) {
        if (!session) return console.log('Please add your session to SESSION env !!');
        const sessdata = session.replace("BLACK MD;;;", '');
        const filer = await File.fromURL(`https://mega.nz/file/${sessdata}`);
        filer.download((err, data) => {
            if (err) throw err;
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
    console.log(color(figlet.textSync("BLACK-MD", { font: "Standard" }), "green"));

    const client = ravenConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["BLACK - AI", "Safari", "5.1.7"],
        auth: state,
        syncFullHistory: true,
    });

    store.bind(client.ev);

    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
                startRaven();
            }
        } else if (connection === 'open') {
            console.log(color("Congrats, BLACK MD has successfully connected", "green"));
            client.groupAcceptInvite('LDBdQY8fKbs1qkPWCTuJGX');
            const Texxt = `✅ 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 » »【BLACK MD】\n👥 𝗠𝗼𝗱𝗲 »» ${mode}\n👤 𝗣𝗿𝗲𝗳𝗶𝘅 »» ${prefix}`;
            client.sendMessage(client.user.id, { text: Texxt });
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

    /* 📩 Message Handling */
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

            // Auto View Status
            if (autoviewstatus === 'TRUE' && mek.key && mek.key.remoteJid === "status@broadcast") {
                await client.readMessages([mek.key]);
            }

            // Auto Like Status
            if (autolike === "TRUE" && mek.key && mek.key.remoteJid === "status@broadcast") {
                const emojis = ['😍', '😇', '😊', '👻', '💀', '❤️‍🔥', '❤️‍🩹', '💥', '🤞', '🫰', '👀', '🦝', '🐺', '🦊', '🐀', '🐁', '🦋', '🫛', '🍭', '♨️'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                await client.sendMessage(mek.key.remoteJid, {
                    react: { key: mek.key, text: randomEmoji }
                });
            }

            // Command Handler
            if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
            let m = smsg(client, mek, store);
            const raven = require("./blacks");
            raven(client, m, chatUpdate, store);

        } catch (err) {
            console.log(err);
        }
    });

    /* 🛡️ Antiforeign / Group Update */
    client.ev.on("group-participants.update", async (update) => {
        if (antiforeign === 'TRUE' && update.action === "add") {
            for (let participant of update.participants) {
                const jid = client.decodeJid(participant);
                const phoneNumber = jid.split("@")[0];
                if (!phoneNumber.startsWith(mycode)) {
                    await client.sendMessage(update.id, {
                        text: "Your Country code is not allowed here!",
                        mentions: [jid]
                    });
                    await client.groupParticipantsUpdate(update.id, [jid], "remove");
                }
            }
        }
        Events(client, update);
    });

    /* 🚫 Anticall */
    client.ev.on('call', async (callData) => {
        if (anticall === 'TRUE') {
            const callId = callData[0].id;
            const callerId = callData[0].from;
            await client.rejectCall(callId, callerId);
            const currentTime = Date.now();
            if (currentTime - lastTextTime >= messageDelay) {
                await client.sendMessage(callerId, { text: "Anticall is active, Only texts are allowed" });
                lastTextTime = currentTime;
            }
        }
    });

    // Helper functions (Simplified for brevity)
    client.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
        } else return jid;
    };

    client.getName = (jid, withoutContact = false) => {
        let id = client.decodeJid(jid);
        let v = id === "0@s.whatsapp.net" ? { id, name: "WhatsApp" } : id === client.decodeJid(client.user.id) ? client.user : store.contacts[id] || {};
        return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international");
    };

    client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text: text, ...options }, { quoted });

    return client;
}

// Start Server
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.listen(port, () => console.log(`Server listening on port ${port}`));

startRaven();

