require('dotenv').config();
const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const distube = new DisTube(client, {
  emitNewSongOnly: true,
  savePreviousSongs: true,
  emitAddSongWhenCreatingQueue: true,
  emitAddListWhenCreatingQueue: true,
  plugins: [
    new SpotifyPlugin({
      api: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      },
    }),
    new YtDlpPlugin(),
  ],
});

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'play') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('🚫 You need to be in a voice channel to play music!');
    if (!args[0]) return message.reply('🚫 Please provide a song name or URL!');

    try {
      console.log(`🎶 Attempting to play: ${args.join(' ')} in channel ${voiceChannel.name}`);
      await distube.play(voiceChannel, args.join(' '), {
        member: message.member,
        textChannel: message.channel,
        message,
      });
    } catch (err) {
      console.error(`[Play Command Error]`, err);
      message.channel.send(`❌ An error occurred while playing: ${err.message}`);
    }
  }
});

distube.on('playSong', async (queue, song) => {
  const embed = new EmbedBuilder()
    .setTitle('🎶 Now Playing')
    .setColor('Green')
    .setThumbnail(song.thumbnail)
    .addFields(
      { name: 'Track:', value: `[\`${song.uploader.name} - ${song.name}\`](${song.url})` },
      { name: 'Requested By:', value: `<@${queue.textChannel.guild.members.cache.get(song.user.id).user.id}>`, inline: true },
      { name: 'Duration:', value: `\`${song.formattedDuration}\``, inline: true }
    )
    .setImage('https://c.tenor.com/fdHXQgnfQGUAAAAC/tenor.gif')
    .setTimestamp()
    .setFooter({ text: `${song.user.tag}`, iconURL: song.user.displayAvatarURL({ dynamic: true }) });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId('previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId('shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('stop').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('repeat').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
    );

  queue.textChannel.send({ embeds: [embed], components: [row, row2] });
});

distube.on('finish', (queue) => {
  queue.textChannel.send('✅ Queue finished.');
});

distube.on('error', (queue, error) => {
  console.error(`[DisTube Error]`, error);
  if (queue?.textChannel) {
    queue.textChannel.send(`❌ An error occurred: ${error.message}`);
  } else {
    console.warn('⚠️ No text channel available to send the error message.');
  }
});

distube.on('warn', (queue, warning) => {
  console.warn(`[DisTube Warning] ${warning}`);
  queue?.textChannel?.send(`⚠️ Warning: ${warning}`);
});

client.login(process.env.TOKEN);
