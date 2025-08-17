// index.js
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');

// Carrega variáveis de ambiente
dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.log("❌ ERRO: Token não encontrado no arquivo .env");
    process.exit(1);
}

// Carrega config.json ou cria vazio
let config = {};
const CONFIG_FILE = './config.json';
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} else {
    config = { creationChannelId: null };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

const tempChannels = new Map();

// Quando o bot ficar online
client.once('ready', () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log(`🆔 ID do Bot: ${client.user.id}`);
    console.log(`📋 Servidores: ${client.guilds.cache.size}`);
    console.log('------');
});

// Comando !setup
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    if (message.content === "!setup") {
        try {
            const guild = message.guild;
            const category = guild.channels.cache.find(c => c.type === 4 && c.name.toLowerCase().includes("voz")) || null; // tenta pegar categoria de voz existente

            const channel = await guild.channels.create({
                name: "➕ Criar Canal",
                type: 2, // Voice
                parent: category?.id || null,
                reason: `Canal de criação configurado por ${message.author.tag}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionsBitField.Flags.Connect]
                    }
                ]
            });

            config.creationChannelId = channel.id;
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

            await message.reply(`✅ Canal de criação configurado: **${channel.name}** (ID: ${channel.id})`);
            console.log(`⚙️ Canal de criação configurado: ${channel.name}`);
        } catch (err) {
            console.error("❌ Erro no !setup:", err);
            await message.reply("❌ Ocorreu um erro ao configurar o canal de criação.");
        }
    }
});

// Sistema de canais temporários
client.on('voiceStateUpdate', async (oldState, newState) => {
    const CREATION_CHANNEL_ID = config.creationChannelId;
    if (!CREATION_CHANNEL_ID) return;

    // Usuário entrou no canal de criação
    if (!oldState.channelId && newState.channelId === CREATION_CHANNEL_ID) {
        try {
            const guild = newState.guild;
            const member = newState.member;
            const category = newState.channel.parent;

            const newChannel = await guild.channels.create({
                name: `🔊 ${member.displayName}`,
                type: 2, // Voice
                parent: category?.id || null,
                userLimit: 7,
                reason: `Canal criado por ${member.user.tag}`,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak
                        ]
                    }
                ]
            });

            await member.voice.setChannel(newChannel);
            tempChannels.set(newChannel.id, member.id);

            console.log(`🎚 Canal criado: ${newChannel.name}`);
        } catch (error) {
            console.log(`❌ Erro ao criar canal: ${error}`);
            try {
                await newState.member.send("⚠️ Não consegui criar seu canal de voz!");
            } catch {}
        }
    }

    // Verifica se canal temporário ficou vazio
    if (oldState.channelId && tempChannels.has(oldState.channelId)) {
        const channel = oldState.channel;
        if (channel && channel.members.size === 0) {
            try {
                await channel.delete();
                tempChannels.delete(channel.id);
                console.log(`🗑 Canal removido: ${channel.name}`);
            } catch (error) {
                console.log(`❌ Erro ao deletar canal: ${error}`);
            }
        }
    }
});

// Inicia o bot
try {
    console.log("🔄 Iniciando bot...");
    client.login(TOKEN);
} catch (error) {
    console.log(`🚨 ERRO inesperado: ${error.name}: ${error.message}`);
}
