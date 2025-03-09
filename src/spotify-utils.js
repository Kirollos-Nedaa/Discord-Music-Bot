require('dotenv').config();
const fetch = require('node-fetch');
const youtubeSearch = require('youtube-search-api');  // Add the YouTube search package

// Spotify Token Fetcher 
async function getSpotifyToken() {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json();
    return data.access_token;
}

// YouTube Search for Track
async function searchYouTube(trackName) {
    try {
        const results = await youtubeSearch.GetListByKeyword(trackName, false);  // Search YouTube
        const video = results.items[0];  // Get the first result
        return video.url;  // Return the YouTube URL for playback
    } catch (error) {
        console.error('Error searching YouTube:', error);
        return null;
    }
}

// Spotify Track Info Fetcher
async function getSpotifyTrackInfo(spotifyUrl) {
    try {
        const urlParts = spotifyUrl.split('/track/');
        if (urlParts.length < 2) return null;

        const trackId = urlParts[1];
        const token = await getSpotifyToken();

        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            console.error(`Spotify API error: ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const songName = data.name || 'Unknown Song';
        const artistName = data.artists.map(artist => artist.name).join(', ') || 'Unknown Artist';
        
        // Track Duration in milliseconds
        const durationMs = data.duration_ms || 0;
        const hours = Math.floor(durationMs / 3600000); // 3600000 ms in an hour
        const minutes = Math.floor((durationMs % 3600000) / 60000); // 60000 ms in a minute
        const seconds = ((durationMs % 60000) / 1000).toFixed(0); // Convert remaining ms to seconds

        // Format each part to always be 2 digits using padStart
        const trackDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.padStart(2, '0')}`;

        // Get artwork URL (largest image)
        const artworkUrl = data.album.images[0].url;

        // Search for the track on YouTube
        const playUrl = await searchYouTube(`${songName} ${artistName}`);  // Get YouTube URL

        return { songName, artistName, trackDuration, trackId, artworkUrl, playUrl };
    } catch (error) {
        console.error(`Error fetching track info: ${error.message}`);
        return null;
    }
}

module.exports = { getSpotifyToken, getSpotifyTrackInfo };
