require('dotenv').config();
const { Client, IntentsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GatewayIntentBits } = require('discord.js');
const { getSpotifyTrackInfo } = require('./spotify-utils');
const { getYouTubeVideoInfo } = require('./youtube-utils');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

// Discord Client Setup
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// Store connections and queues
const voiceConnections = new Map();
const queues = new Map();
let lastCommandChannelId = null;

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isChatInputCommand()) return;

    const userMention = `<@${interaction.user.id}>`;

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'play') {
            const query = interaction.options.getString('query');
            let songDetails = { songName: query, artistName: '', trackDuration: '', trackId: query };

            if (query.includes('spotify.com/track/')) {
                const trackInfo = await getSpotifyTrackInfo(query).catch(err => {
                    interaction.reply('Failed to retrieve track information.');
                    return null;
                });
                if (trackInfo) {
                    songDetails = trackInfo;
                }
            }

            const member = interaction.guild.members.cache.get(interaction.user.id);
            const voiceChannel = member.voice.channel;

            if (!voiceChannel) {
                const embed_error = new EmbedBuilder()
                .setDescription('You need to **join** a voice channel first.')
                .setColor('Red')
                .setTimestamp()
                .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

            await interaction.reply({ embeds: [embed_error] });
            }

            let connection = voiceConnections.get(interaction.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                voiceConnections.set(interaction.guild.id, connection);
                lastCommandChannelId = interaction.channelId;
            }

            if (!queues.has(interaction.guild.id)) {
                queues.set(interaction.guild.id, []);
            }

            const queue = queues.get(interaction.guild.id);
            queue.push(songDetails);

            if (queue.length === 1) {
                playSong(interaction, connection, queue);
            } else {
                const embed_queue = new EmbedBuilder()
                    .setColor('Green')
                    .addFields(
                        { name: 'Track Queued:', value: `\`#${queue.length}\` - [\`${songDetails.artistName} - ${songDetails.songName}\`](https://open.spotify.com/track/${songDetails.trackId})`, inline: true },
                        { name: 'Requested by:', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Duration:', value: `\`${songDetails.trackDuration}\``, inline: true },
                    );
            
                await interaction.reply({ embeds: [embed_queue] });
            }
            
        }

        if (interaction.commandName === 'skip') {
            const queue = queues.get(interaction.guild.id);
            if (queue && queue.length > 1) {
                queue.shift();
                const connection = voiceConnections.get(interaction.guild.id);
                playSong(interaction, connection, queue);
                const song = queue[0];
                const embed = new EmbedBuilder()
                    .setTitle('🎶 Now Playing')
                    .setColor('Green')
                    .setThumbnail(song.artworkUrl)
                    .addFields(
                        { name: 'Track:', value: `[\`${song.artistName} - ${song.songName}\`](https://open.spotify.com/track/${song.trackId})`},
                        { name: 'Requested By:', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Duration:', value: `\`${song.trackDuration}\``, inline: true }
                    )
                    .setImage('https://c.tenor.com/fdHXQgnfQGUAAAAC/tenor.gif')
                    .setTimestamp()
                    .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('pause')
                            .setEmoji('⏸️')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('skip')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary),
                    );
                
                    const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('shuffle')
                            .setEmoji('🔀')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('stop')
                            .setEmoji('🚫')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('repeat')
                            .setEmoji('🔁')
                            .setStyle(ButtonStyle.Secondary),
                    );
                
                interaction.reply({ embeds: [embed], components: [row, row2] });
            } else {
                const embed_noActive = new EmbedBuilder()
                    .setDescription('No active playback to control.')
                    .setColor('Red')
                    .setTimestamp()
                    .setFooter({ 
                        text: `${interaction.user.tag}`, 
                        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                    });

                interaction.reply({ embeds: [embed_noActive] });
            }
        }

        if (interaction.commandName === 'stop') {
            const connection = getVoiceConnection(interaction.guild.id);

            if (connection) {
                connection.destroy();
                voiceConnections.delete(interaction.guild.id);
                queues.delete(interaction.guild.id);

                const embed_stop = new EmbedBuilder()
                    .setDescription(`${userMention} **Stopped** the track,\n And the bot has **disconnected** from the voice channel.`)
                    .setColor('Red')
                    .setTimestamp()
                    .setFooter({ 
                        text: `${interaction.user.tag}`, 
                        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                    });

                await interaction.reply({ embeds: [embed_stop] });
            } else {
                const embed_error = new EmbedBuilder()
                    .setDescription('The bot is **not connected** to a voice channel.')
                    .setColor('Orange')
                    .setTimestamp()
                    .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

                await interaction.reply({ embeds: [embed_error] });
            }
        }
    }

    if (interaction.isButton()) {
        const connection = getVoiceConnection(interaction.guild.id);
        const queue = queues.get(interaction.guild.id);

        if (!connection || !queue) {
            const embed_error = new EmbedBuilder()
                    .setDescription('The bot is **not connected** to a voice channel.')
                    .setColor('Orange')
                    .setTimestamp()
                    .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

                await interaction.reply({ embeds: [embed_error] });
        }

        if (interaction.customId === 'stop') {
            connection.destroy();
            voiceConnections.delete(interaction.guild.id);
            queues.delete(interaction.guild.id);

            const embed_stop = new EmbedBuilder()
                .setDescription(`${userMention} **Stopped** the track, And the queue was **cleared**.`)
                .setColor('Red')
                .setTimestamp()
                .setFooter({ 
                    text: `${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                });

            await interaction.reply({ embeds: [embed_stop] });
        } else if (interaction.customId === 'previous') {
            const song = queue.length - 1;
            const embed = new EmbedBuilder()
                .setTitle('🎶 Now Playing')
                .setColor('Green')
                .setThumbnail(song.artworkUrl)
                .addFields(
                    { name: 'Track:', value: `[\`${song.artistName} - ${song.songName}\`](https://open.spotify.com/track/${song.trackId})`},
                    { name: 'Requested By:', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Duration:', value: `\`${song.trackDuration}\``, inline: true }
                )
                .setImage('https://c.tenor.com/fdHXQgnfQGUAAAAC/tenor.gif')
                .setTimestamp()
                .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setEmoji('⏮️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('pause')
                        .setEmoji('⏸️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary),
                );
            
                const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setEmoji('🔀')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setEmoji('🚫')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('repeat')
                        .setEmoji('🔁')
                        .setStyle(ButtonStyle.Secondary),
                );
            
            interaction.reply({ embeds: [embed], components: [row, row2] });
        } else if (interaction.customId === 'pause') {
            await interaction.reply('The track has been paused!');
        } else if (interaction.customId === 'skip') {
            if (queue.length > 1) {
                queue.shift();
                playSong(interaction, connection, queue);
                const song = queue[0];
                const embed = new EmbedBuilder()
                    .setTitle('🎶 Now Playing')
                    .setColor('Green')
                    .setThumbnail(song.artworkUrl)
                    .addFields(
                        { name: 'Track:', value: `[\`${song.artistName} - ${song.songName}\`](https://open.spotify.com/track/${song.trackId})`},
                        { name: 'Requested By:', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Duration:', value: `\`${song.trackDuration}\``, inline: true }
                    )
                    .setImage('https://c.tenor.com/fdHXQgnfQGUAAAAC/tenor.gif')
                    .setTimestamp()
                    .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('pause')
                            .setEmoji('⏸️')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('skip')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary),
                    );
                
                    const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('shuffle')
                            .setEmoji('🔀')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('stop')
                            .setEmoji('🚫')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('repeat')
                            .setEmoji('🔁')
                            .setStyle(ButtonStyle.Secondary),
                    );
                
                interaction.reply({ embeds: [embed], components: [row, row2] });
            } else {
                interaction.reply('There are no more songs to skip to!');
            }
        } else if (interaction.customId === 'repeat') {
            await interaction.reply('Repeating the track!');
        } else if (interaction.customId === 'shuffle') {
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
            const embed_stop = new EmbedBuilder()
                .setDescription(`${userMention} **Turned shuffle on!**`)
                .setColor('Red')
                .setTimestamp()
                .setFooter({ 
                    text: `${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                });
            await interaction.reply({ embeds: [embed_stop]});
        }
    }
});

function playSong(interaction, connection, queue) {
    if (!queue.length) {
        interaction.channel.send('The queue is empty. Disconnecting from the voice channel.');
        connection.destroy();
        voiceConnections.delete(interaction.guild.id);
        return;
    }

    const song = queue[0];
    const embed = new EmbedBuilder()
        .setTitle('🎶 Now Playing')
        .setColor('Green')
        .setThumbnail(song.artworkUrl)
        .addFields(
            { name: 'Track:', value: `[\`${song.artistName} - ${song.songName}\`](https://open.spotify.com/track/${song.trackId})`},
            { name: 'Requested By:', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Duration:', value: `\`${song.trackDuration}\``, inline: true }
        )
        .setImage('https://c.tenor.com/fdHXQgnfQGUAAAAC/tenor.gif')
        .setTimestamp()
        .setFooter({ text: `${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('previous')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('pause')
                .setEmoji('⏸️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
        );

        const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('shuffle')
                .setEmoji('🔀')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setEmoji('🚫')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('repeat')
                .setEmoji('🔁')
                .setStyle(ButtonStyle.Secondary),
        );

    interaction.reply({ embeds: [embed], components: [row, row2] });

    //Acual playback
}

client.on('voiceStateUpdate', (oldState) => {
    const guild = oldState.guild;
    const connection = getVoiceConnection(guild.id);
  
    if (!connection) return; // Exit if there's no active connection
  
    // Get the voice channel the bot is in
    const botChannel = connection.joinConfig.channelId;
    const botVoiceChannel = guild.channels.cache.get(botChannel);
  
    if (botVoiceChannel && botVoiceChannel.members.size === 1) {
      // Set a 1-minute timeout before disconnecting
      setTimeout(() => {
        const updatedChannel = guild.channels.cache.get(botChannel);
        if (updatedChannel && updatedChannel.members.size === 1) {
          connection.destroy();
  
          const embed_discon = new EmbedBuilder()
            .setDescription('Disconnected due to inactivity')
            .setColor('Red')
            .setTimestamp();
  
          // Use the stored channel ID to send the embed
          const logChannel = guild.channels.cache.get(lastCommandChannelId);
          if (logChannel) {
            logChannel
              .send({ embeds: [embed_discon] })
              .catch(err => console.error('Failed to send embed:', err));
          }
        }
      }, 30000); // 30s
    }
});

client.login(process.env.TOKEN);