import fs from 'fs';
import path from 'path';
<<<<<<< HEAD
import os from 'os';
import sharp from 'sharp';
import { getVideoDurationInSeconds } from 'get-video-duration';
// import { logger } from '../utils/logger'; // Removed: Plugin global
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Configure ffmpeg
if (ffmpegPath) {
  console.log('[MediaScanner] Setting ffmpeg path to:', ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.error('[MediaScanner] ffmpeg-static returned null/undefined path!');
}
=======
import sharp from 'sharp';
import { getVideoDurationInSeconds } from 'get-video-duration';
>>>>>>> 85d63be57c526f93696018d237b9ec9ddcf72eb1

// Supported media extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];

interface MediaItemData {
  filename: string;
  fileType: 'image' | 'video' | 'audio';
  fileSize: number;
  duration?: number;
  thumbnailUrl: string;
  filePath: string;
}

/**
 * Generate a thumbnail for an image file
 * @param filePath Full path to the image file
 * @returns Base64 encoded JPEG thumbnail
 */
export const generateImageThumbnail = async (filePath: string): Promise<string> => {
  try {
    const buffer = await sharp(filePath)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toBuffer();

<<<<<<< HEAD
    // Fix base64 mime type from previous typo
=======

 * Generate a thumbnail for video files using ffmpeg
 * @param filePath Full path to the video file
 * @returns Base64 encoded PNG thumbnail
 */
export const generateVideoThumbnail = async (filePath: string): Promise<string> => {
  return new Promise((resolve) => {
    try {
      let tempDir = os.tmpdir();
      // Debug log saw 'undefined\temp', so force a safe local path if it looks weird
      if (!tempDir || tempDir.includes('undefined')) {
        tempDir = path.resolve(process.cwd(), 'temp');
      }

      // Ensure it exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }



      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `thumb-${uniqueSuffix}.png`;
      const tempFilePath = path.join(tempDir, filename);

      ffmpeg(filePath)
        .screenshots({
          count: 1,
          folder: tempDir,
          filename: filename,
          timestamps: ['00:00:00'], // Take the very first frame
          size: '320x?', // Resize to 320px width, auto height
        })
        .on('end', () => {
          try {
            if (fs.existsSync(tempFilePath)) {
              const buffer = fs.readFileSync(tempFilePath);
              const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

              // Cleanup temp file
              fs.unlinkSync(tempFilePath);

              resolve(base64);
            } else {
              logger.warn(`Thumbnail file not created for ${filePath}`);
              resolve(generatePlaceholderThumbnail('video'));
            }
          } catch (err) {
            logger.error(`Error reading thumbnail for ${filePath}:`, err);
            resolve(generatePlaceholderThumbnail('video'));
          }
        })
        .on('error', (err) => {
          if (global.logger) {
            logger.warn(`Failed to generate video thumbnail for ${filePath}: ${err.message}`);
          }
          resolve(generatePlaceholderThumbnail('video'));
        });
    } catch (error) {
      console.error(`[MediaScanner] Critical error setting up ffmpeg for ${filePath}:`, error);
      if (global.logger) {
        logger.error(`Error setting up ffmpeg for ${filePath}:`, error);
      }
      resolve(generatePlaceholderThumbnail('video'));
    }
  });
=======
 * Generate a placeholder thumbnail for video files
 * @returns Base64 encoded SVG placeholder
 */
export const generateVideoThumbnail = async (): Promise<string> => {
  // For MVP, return a placeholder
  // Future: Use ffmpeg to extract frame
  return generatePlaceholderThumbnail('video');
>>>>>>> 85d63be57c526f93696018d237b9ec9ddcf72eb1
  };

  /**
   * Generate a placeholder thumbnail for audio files
   */
  export const generateAudioThumbnail = async (): Promise<string> => {
    return generatePlaceholderThumbnail('audio');
  };

  /**
   * Generate a placeholder SVG thumbnail
   * @param type Type of media (image, video, or audio)
   * @returns Base64 encoded SVG
   */
  const generatePlaceholderThumbnail = (type: 'image' | 'video' | 'audio'): string => {
    let icon = '🖼';
    let color = '#10b981';

    if (type === 'video') {
      icon = '▶';
      color = '#3b82f6';
    } else if (type === 'audio') {
      icon = '🎵';
      color = '#8b5cf6';
    }

    const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="${color}"/>
    <text x="50%" y="50%" font-size="60" fill="white" text-anchor="middle" dominant-baseline="middle">${icon}</text>
  </svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  };

  /**
   * Get the duration of a video file in seconds
   * @param filePath Full path to the video file
   * @returns Duration in seconds or undefined if unable to determine
   */
  const getVideoDuration = async (filePath: string): Promise<number | undefined> => {
    try {
      const duration = await getVideoDurationInSeconds(filePath);
      return duration;
    } catch (error) {
      logger.debug(`Could not determine video duration for ${filePath}`);
      return undefined;
    }
  };

  /**
   * Scan a folder for media files and generate metadata
   * @param folderPath Absolute path to the folder to scan
   * @returns Array of media item data
   */
  export const scanMediaFolder = async (folderPath: string): Promise<MediaItemData[]> => {
    const mediaItems: MediaItemData[] = [];

    try {
      // Verify folder exists
      if (!fs.existsSync(folderPath)) {
        throw new Error(`Folder does not exist: ${folderPath}`);
      }

      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
      }

      // Read directory contents
      const files = fs.readdirSync(folderPath);

      for (const filename of files) {
        const filePath = path.join(folderPath, filename);

        // Skip if not a file
        try {
          const fileStats = fs.statSync(filePath);
          if (!fileStats.isFile()) {
            continue;
          }

          // Get file extension
          const ext = path.extname(filename).toLowerCase();

          // Determine file type
          let fileType: 'image' | 'video' | 'audio' | null = null;
          if (IMAGE_EXTENSIONS.includes(ext)) {
            fileType = 'image';
          } else if (VIDEO_EXTENSIONS.includes(ext)) {
            fileType = 'video';
          } else if (AUDIO_EXTENSIONS.includes(ext)) {
            fileType = 'audio';
          }

          // Skip unsupported files
          if (!fileType) {
            continue;
          }

          // Generate thumbnail
          let thumbnailUrl: string;
          if (fileType === 'image') {
            thumbnailUrl = await generateImageThumbnail(filePath);
          } else if (fileType === 'video') {
<<<<<<< HEAD
            thumbnailUrl = await generateVideoThumbnail(filePath);
=======
          thumbnailUrl = await generateVideoThumbnail();
>>>>>>> 85d63be57c526f93696018d237b9ec9ddcf72eb1
          } else {
            thumbnailUrl = await generateAudioThumbnail();
          }

          // Get duration for videos and audio
          let duration: number | undefined;
          if (fileType === 'video' || fileType === 'audio') {
            duration = await getVideoDuration(filePath);
          }

          mediaItems.push({
            filename,
            fileType,
            fileSize: fileStats.size,
            duration,
            thumbnailUrl,
            filePath,
          });

          logger.debug(`Scanned media: ${filename} (${fileType})`);
        } catch (e) {
          logger.warn(`Error processing file ${filename}:`, e);
        }
      }

      logger.info(`Scanned ${mediaItems.length} media files from ${folderPath}`);
      return mediaItems;
    } catch (error) {
      logger.error(`Error scanning folder ${folderPath}:`, error);
      throw error;
    }
  };
