# 🎵 Discord Music Bot

A feature-rich and interactive music bot for Discord that supports Spotify and YouTube links, allowing users to play, queue, shuffle, and control music playback seamlessly. Built with `discord.js` and `@discordjs/voice`.

## ⚠️ Disclaimer
Currently, this bot does not support music playback. I am actively working on this feature.

## 🚀 Features
- **🎶 Play Music**: Supports Spotify track links and general search queries.
- **📃 Queue System**: Adds songs to a queue and plays them in order.
- **⏭️ Skip Tracks**: Allows users to skip to the next song in the queue.
- **⏸️ Pause & Resume**: Pause and resume playback with interactive buttons.
- **🔀 Shuffle**: Randomizes the order of the queued songs.
- **🚫 Stop & Disconnect**: Stops playback and clears the queue when leaving.
- **⏮️ Previous Track**: Navigate back to the last song played.
- **🔁 Repeat**: Replay the current song.
- **⏳ Auto Disconnect**: Leaves the voice channel after 30 seconds of inactivity.
- **🖥️ Embed Display**: Display the artist and track name as well as the thumbnail of the track and the duration of the track.

## 🛠️ Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/discord-music-bot.git
   cd discord-music-bot
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Set up your `.env` file:
   ```env
   TOKEN=your-discord-bot-token
   ```
4. Start the bot:
   ```sh
   nodemon index.js
   ```

## 🎧 Usage

1. **Join a voice channel** in your Discord server.
2. Use the `/play [song name or Spotify link]` command to start playing music.
3. Control playback using buttons or commands:
   - `/skip` - Skip to the next track.
   - `/pause` - Pause the current track.
   - `/resume` - Resume the paused track.
   - `/stop` - Stop playback and disconnect.
   - `/shuffle` - Shuffle the queue.
   - `/repeat` - Repeat the current song.

## 📜 Requirements
- Node.js `v16+`
- `discord.js v14`
- `@discordjs/voice`

## 🛠️ Contributing
Contributions are welcome! Feel free to submit issues or pull requests to improve the bot.

## 📺 Showcase
![image](https://github.com/user-attachments/assets/d4296864-f0be-4880-b51c-32cc29c8567a)


---
✨ Developed with passion by [Kirollos Nedaa]
