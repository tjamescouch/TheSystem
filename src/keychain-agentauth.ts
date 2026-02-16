import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

type StartOpts = {
  port: number;
};

async function readKeyFromKeychain(provider: string): Promise<string> {
  const svc = `thesystem/${provider}`;
  const { stdout } = await exec('security', ['find-generic-password', '-a', provider, '-s', svc, '-w']);
  const key = stdout.trim();
  if (!key) throw new Error(`Empty key for provider ${provider}`);
  return key;
}

/**
 * Minimal host-side agentauth proxy.
 * - /agentauth/health -> 200 OK
 * - /anthropic/* -> forwards to https://api.anthropic.com/* with x-api-key from Keychain
 *
 * SECURITY NOTE:
 * This intentionally only listens on localhost and never logs secrets.
 */
export async function startAgentAuthProxy(opts: StartOpts): Promise<void> {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (url.pathname === '/agentauth/health') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
        return;
      }

      // Anthropic proxy
      if (url.pathname === '/anthropic' || url.pathname.startsWith('/anthropic/')) {
        const upstreamPath = url.pathname.replace(/^\/anthropic/, '') || '/';
        const upstreamUrl = new URL(`https://api.anthropic.com${upstreamPath}${url.search}`);

        const apiKey = await readKeyFromKeychain('anthropic');

        // Read request body
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', async () => {
          const body = Buffer.concat(chunks);

          const headers: Record<string, string> = {
            'x-api-key': apiKey,
            'anthropic-version': String(req.headers['anthropic-version'] || '2023-06-01'),
          };
          if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);

          // Pass through selected headers (no auth headers)
          const resp = await fetch(upstreamUrl, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes((req.method || 'GET').toUpperCase()) ? undefined : body,
          });

          res.writeHead(resp.status, Object.fromEntries(resp.headers.entries()));
          const respBuf = Buffer.from(await resp.arrayBuffer());
          res.end(respBuf);
        });
        return;
      }

      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    } catch (err: any) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('error');
    }
  });

  server.listen(opts.port, '127.0.0.1', () => {
    console.log(`[thesystem] agentauth proxy listening on http://127.0.0.1:${opts.port}`);
  });

  // Keep process alive
  await new Promise(() => {});
}
