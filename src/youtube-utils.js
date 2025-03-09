const youtube = require('youtube-sr').default;

/**
 * Fetches YouTube video info by its URL or ID.
 * @param {string} videoId The ID or URL of the YouTube video.
 * @returns {Promise<object>} Video details.
 */
async function getYouTubeVideoInfo(videoId) {
    try {
        const video = await youtube.getVideo(videoId);
        return {
            title: video.title,
            url: video.url,
            duration: video.durationFormatted,
            thumbnail: video.thumbnail.url,
        };
    } catch (error) {
        console.error('Error fetching YouTube video info:', error);
        throw new Error('Failed to fetch YouTube video information.');
    }
}

module.exports = { getYouTubeVideoInfo };
