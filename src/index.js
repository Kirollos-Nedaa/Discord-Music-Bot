require('dotenv').config();
const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GatewayIntentBits, IntentsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, member } = interaction;

  if (commandName === 'play') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return interaction.reply('🚫 You need to be in a voice channel to play music!');
    const query = options.getString('query');
    if (!query) return interaction.reply('🚫 Please provide a song name or URL!');

    try {
      console.log(`🎶 Attempting to play: ${query} in channel ${voiceChannel.name}`);
      await interaction.deferReply();
      await distube.play(voiceChannel, query, {
        member: member,
        textChannel: interaction.channel
      });
    } catch (err) {
      console.error(`[Play Command Error]`, err);
      interaction.reply(`❌ An error occurred while playing: ${err.message}`);
    }
  }
});

const createControlRow = (buttons) => {
  return new ActionRowBuilder().addComponents(
    ...buttons.map(({ id, emoji, style }) => new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(style))
  );
};

const controls1 = createControlRow([
  { id: 'previous', emoji: '⏮️', style: ButtonStyle.Secondary },
  { id: 'pause', emoji: '⏸️', style: ButtonStyle.Secondary },
  { id: 'skip', emoji: '⏭️', style: ButtonStyle.Secondary },
]);

const controls2 = createControlRow([
  { id: 'shuffle', emoji: '🔀', style: ButtonStyle.Secondary },
  { id: 'stop', emoji: '🚫', style: ButtonStyle.Secondary },
  { id: 'repeat', emoji: '🔁', style: ButtonStyle.Secondary },
]);

const nowPlayingEmbed = (song) => new EmbedBuilder()
  .setTitle('🎶 Now Playing')
  .setColor('Green')
  .setThumbnail(song.thumbnail)
  .addFields(
    { name: 'Track:', value: `[\`${song.name}\`](${song.url})` },
    { name: 'Requested By:', value: `<@${song.user.id}>`, inline: true },
    { name: 'Duration:', value: `\`${song.formattedDuration}\``, inline: true }
  )
  .setImage('https://c.tenor.com/fdHXQgnfQGUAAAAC/tenor.gif')
  .setTimestamp()
  .setFooter({ text: `${song.user.tag}`, iconURL: song.user.displayAvatarURL({ dynamic: true }) });

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const queue = distube.getQueue(interaction.guild.id);

  if (interaction.customId === 'stop') {
    await interaction.deferReply();
    if (queue) {
      queue.stop();
      const embed_stop = new EmbedBuilder()
        .setDescription(`🚫 Music playback stopped and **the queue has been cleared**.`)
        .setColor('Red')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed_stop] });
    } else {
      await interaction.editReply({ content: '🚫 Not connected to any voice channel.', ephemeral: true });
    }
  }

  if (interaction.customId === 'pause') {
    if (queue) {
      queue.pause();
      interaction.update({
        components: [createControlRow([
          { id: 'previous', emoji: '⏮️', style: ButtonStyle.Secondary },
          { id: 'resume', emoji: '▶️', style: ButtonStyle.Secondary },
          { id: 'skip', emoji: '⏭️', style: ButtonStyle.Secondary },
        ]), controls2],
      });
    }
  }

  if (interaction.customId === 'resume') {
    if (queue) {
      queue.resume();
      interaction.update({ components: [controls1, controls2] });
    }
  }

  if (interaction.customId === 'skip') {
    await interaction.deferReply();
    if (queue && queue.songs.length > 1) {
      queue.skip();
      const embed_skip = new EmbedBuilder()
        .setDescription('⏭️ **Song Skipped!** Playing next track in the queue.')
        .setColor('Blue')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed_skip] });
    } else {
      const embed_skip_end = new EmbedBuilder()
        .setDescription(`🚫 No more songs in the queue to skip to.`)
        .setColor('Red')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed_skip_end] });
    }
  }
});

distube.on('playSong', (queue, song) => {
  queue.textChannel?.send({ embeds: [nowPlayingEmbed(song)], components: [controls1, controls2] });
});

distube.on('addSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor('Blue')
    .addFields(
      { name: 'Track Queued:', value: `**#\`${queue.songs.length}\`** - [\`${song.name}\`](${song.url})`, inline: true },
      { name: 'Requested by:', value: `<@${song.user.id}>`, inline: true },
      { name: 'Duration:', value: `\`${song.formattedDuration}\``, inline: true }
    )
    .setTimestamp()
    .setFooter({ 
      text: `${song.user.tag}`, 
      iconURL: song.user.displayAvatarURL({ dynamic: true }),
    });
  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('finish', (queue) => {
  const embedf = new EmbedBuilder()
    .setColor('Green')
    .setDescription(`**Queue finished.**`)
    .setTimestamp();
  queue.textChannel?.send({ embeds: [embedf] });
});

distube.on('error', (queue, error) => {
  console.error(`[DisTube Error]`, error);
  queue.textChannel?.send(`❌ An error occurred: ${error.message}`);
});

distube.on('warn', (queue, warning) => {
  console.warn(`[DisTube Warning] ${warning}`);
  queue.textChannel?.send(`⚠️ Warning: ${warning}`);
});

client.login(process.env.TOKEN);
