import fs from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import * as mimeTypes from 'mime-types';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../services/utils';
import { promisedGtts, readGttsAsStream, deleteGtts } from '../../services/gtts';

const pump = promisify(pipeline);

// Interface for query parameters
interface MediaFilesQuery {
  folderPath?: string;
}

// Interface for request body
interface SendMediaBody {
  guildId: string;
  mediaUrl: string;
  mediaType: string;
  fileName: string;
}

interface TextToSpeechBody {
  guildId: string;
  text: string;
  hidden: boolean;
}

interface StopBody {
  guildId: string;
}

interface SettingsBody {
  guildId: string;
  defaultMediaTime?: number | null;
  maxMediaTime?: number | null;
  displayFull?: boolean;
}

interface SendMediaWithParamsBody {
  guildId: string;
  mediaUrl: string;
  text?: string;
  hidden: boolean;
}

// Sanitize filename to prevent directory traversal
function sanitizeFilename(filename: string): string {
  // Remove any path separators and keep only the filename
  return filename.replace(/[/\\]/g, '_').replace(/\.\./g, '_');
}

// Validate folder path to prevent directory traversal
function isPathSafe(folderPath: string): boolean {
  // Resolve the path to normalize it
  const resolvedPath = resolve(folderPath);
  
  // Check for common directory traversal patterns
  const dangerousPatterns = ['..', '~', '$'];
  for (const pattern of dangerousPatterns) {
    if (folderPath.includes(pattern)) {
      return false;
    }
  }
  
  // Additional check: ensure the path is absolute and doesn't go up
  if (!folderPath.startsWith('/') && !folderPath.match(/^[A-Z]:\\/i)) {
    return false;
  }
  
  return true;
}

export const ControlRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    // Serve the control panel HTML
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'control.html'));
      reply.type('text/html');
      return stream;
    });

    // Get media files from a folder
    fastify.get('/media-files', async function (req, reply) {
      const { folderPath } = req.query as MediaFilesQuery;

      if (!folderPath) {
        return reply.status(400).send({ error: 'folderPath is required' });
      }

      // Validate path to prevent directory traversal
      if (!isPathSafe(folderPath)) {
        return reply.status(400).send({ error: 'Invalid folder path' });
      }

      try {
        // Check if folder exists
        if (!fs.existsSync(folderPath)) {
          return reply.status(404).send({ error: 'Folder not found' });
        }

        // Read folder contents
        const files = fs.readdirSync(folderPath);

        // Filter for media files (images and videos)
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.avi'];
        const mediaFiles = files
          .filter((file) => {
            const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
            return mediaExtensions.includes(ext);
          })
          .map((file) => {
            const filePath = join(folderPath, file);
            const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
            const isVideo = ['.mp4', '.webm', '.mov', '.avi'].includes(ext);
            
            // Get file stats for modification date
            let modificationDate = 0;
            try {
              const stats = fs.statSync(filePath);
              modificationDate = stats.mtimeMs;
            } catch (e) {
              // Ignore stat errors
            }

            return {
              name: file,
              path: filePath,
              type: isVideo ? 'video' : 'image',
              isUploaded: false,
              date: modificationDate,
            };
          });

        return { files: mediaFiles };
      } catch (error: any) {
        logger.error('[CONTROL] Error reading folder:', error);
        return reply.status(500).send({ error: 'Failed to read folder', message: error.message });
      }
    });

    // Upload media file
    fastify.post('/upload-media', async function (req, reply) {
      try {
        const data = await req.file();

        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' });
        }

        const guildIdField = data.fields.guildId;
        const guildId = typeof guildIdField === 'object' && 'value' in guildIdField ? guildIdField.value : guildIdField;
        if (!guildId) {
          return reply.status(400).send({ error: 'guildId is required' });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Sanitize and generate unique filename
        const timestamp = Date.now();
        const sanitizedOriginalName = sanitizeFilename(data.filename);
        const filename = `${timestamp}-${sanitizedOriginalName}`;
        const filepath = join(uploadsDir, filename);

        // Save file to disk
        await pump(data.file, fs.createWriteStream(filepath));

        // Generate URL for the file
        const fileUrl = `${env.API_URL}/control/uploads/${filename}`;

        logger.info(`[CONTROL] File uploaded: ${filename}`);

        return { url: fileUrl, filename };
      } catch (error: any) {
        logger.error('[CONTROL] Error uploading file:', error);
        return reply.status(500).send({ error: 'Failed to upload file', message: error.message });
      }
    });

    // Serve uploaded files
    fastify.get('/uploads/:filename', async function (req, reply) {
      const { filename } = req.params as { filename: string };
      
      // Sanitize filename to prevent directory traversal
      const sanitizedFilename = sanitizeFilename(filename);
      const filepath = join(process.cwd(), 'uploads', sanitizedFilename);

      if (!fs.existsSync(filepath)) {
        return reply.status(404).send({ error: 'File not found' });
      }

      const mimeType = mimeTypes.lookup(filepath) || 'application/octet-stream';
      const stream = fs.createReadStream(filepath);

      reply.type(mimeType);
      return stream;
    });

    // Send media to stream
    fastify.post('/send-media', async function (req, reply) {
      const { guildId, mediaUrl, mediaType, fileName } = req.body as SendMediaBody;

      if (!guildId || !mediaUrl) {
        return reply.status(400).send({ error: 'guildId and mediaUrl are required' });
      }

      try {
        // Get content information
        let mediaContentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        let mediaDuration: number | undefined;
        let mediaIsShort = false;

        const additionalContent = await getContentInformationsFromUrl(mediaUrl);

        if (additionalContent?.contentType) {
          mediaContentType = additionalContent.contentType;
        }

        if (additionalContent?.mediaDuration) {
          mediaDuration = additionalContent.mediaDuration;
        }

        if (additionalContent?.mediaIsShort) {
          mediaIsShort = additionalContent.mediaIsShort || false;
        }

        // Create queue entry
        await prisma.queue.create({
          data: {
            content: JSON.stringify({
              media: mediaUrl,
              mediaContentType,
              mediaDuration: await getDurationFromGuildId(
                mediaDuration ? Math.ceil(mediaDuration) : undefined,
                guildId,
              ),
              displayFull: await getDisplayMediaFullFromGuildId(guildId),
              mediaIsShort,
            }),
            type: QueueType.MESSAGE,
            author: 'Media Control Panel',
            authorImage: null,
            discordGuildId: guildId,
            duration: await getDurationFromGuildId(mediaDuration ? Math.ceil(mediaDuration) : undefined, guildId),
          },
        });

        logger.info(`[CONTROL] Media sent to stream: ${fileName} (guild: ${guildId})`);

        return { success: true, message: 'Media sent to stream' };
      } catch (error: any) {
        logger.error('[CONTROL] Error sending media:', error);
        return reply.status(500).send({ error: 'Failed to send media', message: error.message });
      }
    });

    // Send media with parameters (like /send and /hsend commands)
    fastify.post('/send-media-with-params', async function (req, reply) {
      const { guildId, mediaUrl, text, hidden } = req.body as SendMediaWithParamsBody;

      if (!guildId || !mediaUrl) {
        return reply.status(400).send({ error: 'guildId and mediaUrl are required' });
      }

      try {
        // Get content information
        const additionalContent = await getContentInformationsFromUrl(mediaUrl);

        let mediaContentType = 'application/octet-stream';
        let mediaDuration: number | undefined;
        let mediaIsShort = false;

        if (additionalContent?.contentType) {
          mediaContentType = additionalContent.contentType;
        }

        if (additionalContent?.mediaDuration) {
          mediaDuration = additionalContent.mediaDuration;
        }

        if (additionalContent?.mediaIsShort) {
          mediaIsShort = additionalContent.mediaIsShort;
        }

        // Calculate duration once to avoid duplicate async calls
        const calculatedDuration = await getDurationFromGuildId(
          mediaDuration ? Math.ceil(mediaDuration) : undefined,
          guildId,
        );

        // Create queue entry with optional text and hidden mode
        await prisma.queue.create({
          data: {
            content: JSON.stringify({
              url: mediaUrl,
              text: text,
              media: mediaUrl,
              mediaContentType,
              mediaDuration: calculatedDuration,
              displayFull: await getDisplayMediaFullFromGuildId(guildId),
              mediaIsShort,
            }),
            type: QueueType.MESSAGE,
            author: hidden ? undefined : 'Media Control Panel',
            authorImage: hidden ? undefined : null,
            discordGuildId: guildId,
            duration: calculatedDuration,
          },
        });

        logger.info(`[CONTROL] Media with params sent to stream (guild: ${guildId}, hidden: ${hidden})`);

        return { success: true, message: 'Media sent to stream' };
      } catch (error: any) {
        logger.error('[CONTROL] Error sending media with params:', error);
        return reply.status(500).send({ error: 'Failed to send media', message: error.message });
      }
    });

    // Rename file
    fastify.post('/rename-file', async function (req, reply) {
      const { oldPath, newName, folderPath, isUploaded } = req.body as any;

      if (!oldPath || !newName) {
        return reply.status(400).send({ error: 'oldPath and newName are required' });
      }

      try {
        // Sanitize the new filename
        const sanitizedNewName = sanitizeFilename(newName);

        if (isUploaded) {
          // Handle uploaded files
          const uploadsDir = join(process.cwd(), 'uploads');
          const oldFilename = oldPath.split('/').pop() || oldPath;
          const oldFilePath = join(uploadsDir, sanitizeFilename(oldFilename));
          const newFilePath = join(uploadsDir, sanitizedNewName);

          if (!fs.existsSync(oldFilePath)) {
            return reply.status(404).send({ error: 'File not found' });
          }

          // Check if new filename already exists
          if (fs.existsSync(newFilePath) && oldFilePath !== newFilePath) {
            return reply.status(400).send({ error: 'A file with this name already exists' });
          }

          // Rename the file
          fs.renameSync(oldFilePath, newFilePath);
          logger.info(`[CONTROL] File renamed: ${oldFilename} -> ${sanitizedNewName}`);
        } else {
          // Handle folder files
          if (!folderPath) {
            return reply.status(400).send({ error: 'folderPath is required for folder files' });
          }

          // Validate folder path
          if (!isPathSafe(folderPath)) {
            return reply.status(400).send({ error: 'Invalid folder path' });
          }

          const oldFilename = oldPath.split('/').pop() || oldPath.split('\\').pop() || oldPath;
          const oldFilePath = join(folderPath, oldFilename);
          const newFilePath = join(folderPath, sanitizedNewName);

          if (!fs.existsSync(oldFilePath)) {
            return reply.status(404).send({ error: 'File not found' });
          }

          // Check if new filename already exists
          if (fs.existsSync(newFilePath) && oldFilePath !== newFilePath) {
            return reply.status(400).send({ error: 'A file with this name already exists' });
          }

          // Rename the file
          fs.renameSync(oldFilePath, newFilePath);
          logger.info(`[CONTROL] File renamed: ${oldFilename} -> ${sanitizedNewName} in ${folderPath}`);
        }

        return { success: true, newName: sanitizedNewName };
      } catch (error: any) {
        logger.error('[CONTROL] Error renaming file:', error);
        return reply.status(500).send({ error: 'Failed to rename file', message: error.message });
      }
    });

    // Text-to-speech endpoint
    fastify.post('/text-to-speech', async function (req, reply) {
      const { guildId, text, hidden } = req.body as TextToSpeechBody;

      if (!guildId || !text) {
        return reply.status(400).send({ error: 'guildId and text are required' });
      }

      try {
        // Generate text-to-speech audio
        const filePath = await promisedGtts(text, rosetty.getCurrentLang());
        const fileStream = readGttsAsStream(filePath);

        // Read the stream into a buffer
        const chunks: Buffer[] = [];
        for await (const chunk of fileStream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Save TTS audio to uploads directory
        // NOTE: In production, consider using dedicated file hosting (S3, CDN, etc.)
        const timestamp = Date.now();
        const ttsFilename = `tts-${timestamp}.mp3`;
        const uploadsDir = join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ttsPath = join(uploadsDir, ttsFilename);
        fs.writeFileSync(ttsPath, buffer);

        const mediaUrl = `${env.API_URL}/control/uploads/${ttsFilename}`;

        // Get audio duration
        const additionalContent = await getContentInformationsFromUrl(mediaUrl);

        // Delete the temporary gtts file
        await deleteGtts(filePath);

        // Default TTS duration if detection fails
        const DEFAULT_TTS_DURATION = 5;

        // Create queue entry
        await prisma.queue.create({
          data: {
            content: JSON.stringify({
              text: hidden ? '' : text,
              media: mediaUrl,
              mediaContentType: 'audio/mpeg',
              mediaDuration: Math.ceil(additionalContent?.mediaDuration || DEFAULT_TTS_DURATION),
            }),
            type: QueueType.VOCAL,
            discordGuildId: guildId,
            duration: await getDurationFromGuildId(
              additionalContent?.mediaDuration ? Math.ceil(additionalContent.mediaDuration) : undefined,
              guildId,
            ),
            author: hidden ? 'Hidden User' : 'Media Control Panel',
            authorImage: null,
          },
        });

        logger.info(`[CONTROL] Text-to-speech sent to stream (guild: ${guildId})`);

        return { success: true, message: 'Text-to-speech sent to stream' };
      } catch (error: any) {
        logger.error('[CONTROL] Error sending text-to-speech:', error);
        return reply.status(500).send({ error: 'Failed to send text-to-speech', message: error.message });
      }
    });

    // Stop current media endpoint
    fastify.post('/stop', async function (req, reply) {
      const { guildId } = req.body as StopBody;

      if (!guildId) {
        return reply.status(400).send({ error: 'guildId is required' });
      }

      try {
        // Emit stop event via Socket.IO
        fastify.io.to(`messages-${guildId}`).emit('stop');

        // Update guild busyUntil
        await prisma.guild.update({
          where: {
            id: guildId,
          },
          data: {
            busyUntil: null,
          },
        });

        logger.info(`[CONTROL] Stop signal sent (guild: ${guildId})`);

        return { success: true, message: 'Media stopped' };
      } catch (error: any) {
        logger.error('[CONTROL] Error stopping media:', error);
        return reply.status(500).send({ error: 'Failed to stop media', message: error.message });
      }
    });

    // Get settings endpoint
    fastify.get('/settings', async function (req, reply) {
      const { guildId } = req.query as { guildId?: string };

      if (!guildId) {
        return reply.status(400).send({ error: 'guildId is required' });
      }

      try {
        const guild = await prisma.guild.findUnique({
          where: {
            id: guildId,
          },
        });

        return {
          defaultMediaTime: guild?.defaultMediaTime || null,
          maxMediaTime: guild?.maxMediaTime || null,
          displayFull: guild?.displayFull || false,
        };
      } catch (error: any) {
        logger.error('[CONTROL] Error getting settings:', error);
        return reply.status(500).send({ error: 'Failed to get settings', message: error.message });
      }
    });

    // Save settings endpoint
    fastify.post('/settings', async function (req, reply) {
      const { guildId, defaultMediaTime, maxMediaTime, displayFull } = req.body as SettingsBody;

      if (!guildId) {
        return reply.status(400).send({ error: 'guildId is required' });
      }

      try {
        await prisma.guild.upsert({
          where: {
            id: guildId,
          },
          create: {
            id: guildId,
            defaultMediaTime: defaultMediaTime ?? null,
            maxMediaTime: maxMediaTime ?? null,
            displayFull: displayFull ?? false,
          },
          update: {
            defaultMediaTime: defaultMediaTime ?? null,
            maxMediaTime: maxMediaTime ?? null,
            displayFull: displayFull ?? false,
          },
        });

        logger.info(`[CONTROL] Settings updated (guild: ${guildId})`);

        return { success: true, message: 'Settings saved' };
      } catch (error: any) {
        logger.error('[CONTROL] Error saving settings:', error);
        return reply.status(500).send({ error: 'Failed to save settings', message: error.message });
      }
    });
  };
