import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Path validation function from security practices
const isPathSafe = (filePath: string): boolean => {
  const normalizedPath = path.normalize(filePath);
  // Prevent path traversal attacks
  return !normalizedPath.includes('..');
};

export const AdminRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    /**
     * GET /admin - Serve the admin interface HTML
     */
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(path.join(__dirname, 'admin.html'));
      reply.type('text/html');
      return stream;
    });



    /**
     * POST /api/admin/browse-folder - Open native folder picker
     */
    fastify.post('/api/admin/browse-folder', async function (req, reply) {

      try {
        const scriptPath = path.resolve(process.cwd(), 'src/scripts/Select-Folder.ps1');
        // Use -ExecutionPolicy Bypass to allow the script to run, and -Sta for COM dialogs
        const cmd = `powershell -NoProfile -Sta -ExecutionPolicy Bypass -File "${scriptPath}"`;

        logger.info(`Opening folder picker via script: ${scriptPath}`);

        return new Promise((resolve, reject) => {
          exec(cmd, (error, stdout, stderr) => {
            if (error) {
              logger.error('Error opening folder picker:', error);
              // Fallback or specific error? Usually implies cancelled or system issue.
              // If user cancels, selectedPath is empty string.
              resolve(reply.send({ success: false, error: 'Failed to open picker' }));
              return;
            }
            const selectedPath = stdout.trim();
            if (!selectedPath) {
              // User cancelled
              resolve(reply.send({ success: false, cancelled: true }));
            } else {
              resolve(reply.send({ success: true, path: selectedPath }));
            }
          });
        });
      } catch (error) {
        logger.error('Error in browse-folder:', error);
        return reply.status(500).send({ success: false, error: 'Internal Server Error' });
      }
    });

    /**
     * GET /api/media - Get all shared media with metadata
     */
    fastify.get('/api/media', async function (req, reply) {
      try {
        const mediaItems = await prisma.mediaItem.findMany({
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                isOnline: true,
              },
            },
            folder: {
              select: {
                id: true,
                folderPath: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        return reply.send({
          success: true,
          data: mediaItems,
        });
      } catch (error) {
        logger.error('Error fetching media items:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch media items',
        });
      }
    });

    /**
     * PUT /api/media/:id - Update media item (rename)
     */
    fastify.put('/api/media/:id', async function (req, reply) {
      try {
        const { id } = req.params as { id: string };
        const { name } = req.body as { name: string };

        if (!name) {
          return reply.status(400).send({
            success: false,
            error: 'Name is required',
          });
        }

        const updatedMedia = await prisma.mediaItem.update({
          where: { id },
          data: { name },
        });

        return reply.send({
          success: true,
          data: updatedMedia,
        });
      } catch (error) {
        logger.error('Error updating media:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to update media',
        });
      }
    });

    /**
     * POST /api/media/delete-batch - Delete multiple media items
     */
    fastify.post('/api/media/delete-batch', async function (req, reply) {
      try {
        const { ids } = req.body as { ids: string[] };

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'No IDs provided',
          });
        }

        let deletedCount = 0;
        const errors: any[] = [];

        for (const id of ids) {
          try {
            const mediaItem = await prisma.mediaItem.findUnique({
              where: { id },
              include: { folder: true },
            });

            if (!mediaItem) continue;

            // We do NOT delete the file from disk, only from the database, per user request.
            // const filePath = path.join(mediaItem.folder.folderPath, mediaItem.filename);
            // if (fs.existsSync(filePath)) { ... }

            await prisma.mediaItem.delete({ where: { id } });
            deletedCount++;
          } catch (e: any) {
            errors.push({ id, error: e.message || String(e) });
          }
        }

        return reply.send({
          success: true,
          data: { deletedCount, errors },
        });

      } catch (error) {
        logger.error('Error batch deleting media:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete media items',
        });
      }
    });

    /**
     * GET /api/media/:id/stream - Stream a specific media file
     */
    const streamHandler = async function (req, reply) {
      try {
        const { id } = req.params as { id: string };
        console.log('🎬 Stream request for media:', id);

        // Find the media item
        const mediaItem = await prisma.mediaItem.findUnique({
          where: { id },
          include: {
            folder: true,
          },
        });

        if (!mediaItem) {
          return reply.status(404).send({
            success: false,
            error: 'Media not found',
          });
        }

        // Construct the full file path
        const filePath = path.join(mediaItem.folder.folderPath, mediaItem.filename);

        // Security check: validate path
        if (!isPathSafe(filePath)) {
          logger.warn(`Unsafe path detected: ${filePath}`);
          return reply.status(403).send({
            success: false,
            error: 'Invalid file path',
          });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return reply.status(404).send({
            success: false,
            error: 'File not found on disk',
          });
        }

        // Determine content type
        let contentType = 'application/octet-stream';
        const ext = path.extname(mediaItem.filename).toLowerCase();

        if (mediaItem.fileType === 'image') {
          if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.bmp') contentType = 'image/bmp';
        } else if (mediaItem.fileType === 'video') {
          if (ext === '.mp4') contentType = 'video/mp4';
          else if (ext === '.webm') contentType = 'video/webm';
          else if (ext === '.mov') contentType = 'video/quicktime'; // Keep quicktime, let browser decide based on URL
          else if (ext === '.avi') contentType = 'video/x-msvideo';
          else if (ext === '.mkv') contentType = 'video/x-matroska';
        } else if (mediaItem.fileType === 'audio') {
          if (ext === '.mp3') contentType = 'audio/mpeg';
          else if (ext === '.wav') contentType = 'audio/wav';
          else if (ext === '.ogg') contentType = 'audio/ogg';
          else if (ext === '.flac') contentType = 'audio/flac';
          else if (ext === '.aac') contentType = 'audio/aac';
          else if (ext === '.m4a') contentType = 'audio/mp4';
        }

        // Stream the file
        const stream = fs.createReadStream(filePath);
        reply.type(contentType);
        return stream;
      } catch (error) {
        logger.error('Error streaming media:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to stream media',
        });
      }
    };

    /**
     * GET /api/media/:id/stream - Stream a specific media file
     */
    fastify.get('/api/media/:id/stream', streamHandler);

    /**
     * GET /api/media/:id/stream/:filename - Stream with filename for browser compatibility
     */
    fastify.get('/api/media/:id/stream/:filename', streamHandler);
  };
