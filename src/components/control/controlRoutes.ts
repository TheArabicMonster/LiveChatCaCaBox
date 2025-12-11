import fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import * as mimeTypes from 'mime-types';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../services/utils';

const pump = promisify(pipeline);

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
      const folderPath = (req.query as any).folderPath as string;

      if (!folderPath) {
        return reply.status(400).send({ error: 'folderPath is required' });
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

            return {
              name: file,
              path: filePath,
              type: isVideo ? 'video' : 'image',
              isUploaded: false,
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

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${data.filename}`;
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
      const filepath = join(process.cwd(), 'uploads', filename);

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
      const body = req.body as any;
      const { guildId, mediaUrl, mediaType, fileName } = body;

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
  };
