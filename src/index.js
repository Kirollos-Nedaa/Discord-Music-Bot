require('dotenv').config();
const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GatewayIntentBits } = require('discord.js');
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

const trackQueuedEmbed = (queue, song) => new EmbedBuilder()
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
  if (interaction.isCommand()) {
    const { commandName, options, member } = interaction;

    if (commandName === 'play') {
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) return interaction.reply('🚫 You need to be in a voice channel to play music!').catch(console.error);
      const query = options.getString('query');
      if (!query) return interaction.reply('🚫 Please provide a song name or URL!').catch(console.error);

      try {
        console.log(`🎶 Attempting to play: ${query} in channel ${voiceChannel.name}`);
        await interaction.deferReply();
        await distube.play(voiceChannel, query, {
          member: member,
          textChannel: interaction.channel,
          playlist: true,
        });

        // Wait for the queue to be populated
        const queue = distube.getQueue(interaction.guild.id);
        const song = queue.songs[queue.songs.length - 1];
        const embed = trackQueuedEmbed(queue, song);
        await interaction.editReply({ embeds: [embed] }).catch(console.error);
      } catch (err) {
        console.error(`[Play Command Error]`, err);
        interaction.editReply(`❌ An error occurred while playing: ${err.message}`).catch(console.error);
      }
    }

    if (commandName === 'now-playing') {
      const queue = distube.getQueue(interaction.guild.id);

      if (!queue || !queue.songs.length) {
          return interaction.reply('🚫 No song is currently playing.').catch(console.error);
      }
  
      const currentSong = queue.songs[0];
      const embed = nowPlayingEmbed(currentSong);
      await interaction.reply({ embeds: [embed], components: [controls1, controls2] }).catch(console.error);
    }
  } else if (interaction.isButton()) {
    const queue = distube.getQueue(interaction.guild.id);

    if (interaction.customId === 'stop') {
      await interaction.deferReply();
      if (queue) {
        queue.stop();
        const embed_stop = new EmbedBuilder()
          .setDescription(`<@${queue.songs[0].user.id}> **stopped** the queue.`)
          .setColor('Red')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed_stop], components: [] }).catch(console.error);
      } else {
        await interaction.editReply({ content: '🚫 Not connected to any voice channel.', ephemeral: true }).catch(console.error);
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
        }).catch(console.error);
      }
    }

    if (interaction.customId === 'resume') {
      if (queue) {
        queue.resume();
        interaction.update({ components: [controls1, controls2] }).catch(console.error);
      }
    }

    if (interaction.customId === 'skip') {
      await interaction.deferReply();
      if (queue && queue.songs.length > 1) {
      queue.skip();
      const song = queue.songs[0];
      await interaction.editReply({ embeds: [nowPlayingEmbed(song)], components: [controls1, controls2] }).catch(console.error);
      } else {
      const embed_skip_end = new EmbedBuilder()
        .setDescription(`No more **songs** in the **queue** to skip to.`)
        .setColor('Red')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed_skip_end], components: [controls1, controls2] }).catch(console.error);
      }
    }
  }
});

distube.on('playSong', (queue, song) => {
  queue.textChannel?.send({ embeds: [nowPlayingEmbed(song)], components: [controls1, controls2] });
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
  if (queue?.textChannel) {
    queue.textChannel.send(`❌ An error occurred: ${error.message}`).catch(console.error);
  }
});

distube.on('warn', (queue, warning) => {
  console.warn(`[DisTube Warning] ${warning}`);
  if (queue?.textChannel) {
    queue.textChannel.send(`⚠️ Warning: ${warning}`).catch(console.error);
  }
});

client.login(process.env.TOKEN);