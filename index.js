const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");
require("dotenv").config(); // loadar o .env

const client = new Discord.Client();

const queue = new Map();

client.once("ready", () => {
    console.log("🟩 Online");
});

client.once("reconnecting", () => {
    console.log("🟨 Reconectando");
});

client.once("disconnect", () => {
    console.log("🟥 Desconectado");
});

client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}p`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}s`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}q`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send("Digite um comando válido");
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "Você precisa estar em um canal de voz para escutar música!"
        );
    
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "Estou sem algumas permissões `(CONNECT OR SPEAK)`"
        );
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`**${song.title}** foi adicionado a fila!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "Você precisa estar em um canal de voz para pular uma música!"
        );
    if (!serverQueue)
        return message.channel.send("Não tem nenhuma música para eu pular!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "Você precisa estar em um canal de voz para parar uma música!"
        );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Tocando agora: **${song.title}**`);
}

client.login(token);
