import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let tunnelProcess: ChildProcess | null = null;

/**
 * Starts a Cloudflare tunnel and returns the public URL.
 * @param port The local port to tunnel (default: 3000)
 */
export const startTunnel = (port: number = 3000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cloudflaredPath = path.resolve(process.cwd(), 'cloudflared.exe');

    global.logger?.info(`[Tunnel] Starting cloudflared from: ${cloudflaredPath}`);

    tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${port}`]);

    let urlFound = false;

    // Cloudflare outputs the URL to stderr
    tunnelProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      // logger.debug(`[Tunnel Log] ${output}`);

      // Look for the URL in the logs
      // Example: https://random-name.trycloudflare.com
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

      if (match && !urlFound) {
        urlFound = true;
        const url = match[0];
        global.logger?.info(`[Tunnel] Tunnel established at: ${url}`);
        resolve(url);
      }
    });

    tunnelProcess.on('error', (err) => {
      global.logger?.error('[Tunnel] Failed to start cloudflared:', err);
      reject(err);
    });

    tunnelProcess.on('close', (code) => {
      if (!urlFound) {
        global.logger?.warn(`[Tunnel] cloudflared exited with code ${code} before URL was found.`);
        // Don't reject here if we already resolved, just log
      }
      global.logger?.info(`[Tunnel] cloudflared exited with code ${code}`);
    });
  });
};

/**
 * Stops the running tunnel process
 */
export const stopTunnel = () => {
  if (tunnelProcess) {
    global.logger?.info('[Tunnel] Stopping tunnel...');
    tunnelProcess.kill();
    tunnelProcess = null;
  }
};

// Ensure we kill the tunnel when the app exits
process.on('exit', stopTunnel);
process.on('SIGINT', () => {
  stopTunnel();
  process.exit();
});
