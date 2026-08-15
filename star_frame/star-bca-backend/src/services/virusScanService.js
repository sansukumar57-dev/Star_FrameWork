const net = require('net');

/**
 * Pluggable ClamAV virus scanner.
 *
 * When CLAMAV_HOST (+ CLAMAV_PORT) is configured, evidence buffers are streamed
 * to a local clamd daemon over TCP (INSTREAM protocol). When unconfigured the
 * scanner safely passes files through with a warning so uploads never break.
 */

function isConfigured() {
  return Boolean(process.env.CLAMAV_HOST);
}

function config() {
  return {
    host: process.env.CLAMAV_HOST || '127.0.0.1',
    port: Number(process.env.CLAMAV_PORT || 3310) || 3310,
    timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS || 20000) || 20000,
    chunkSize: Number(process.env.CLAMAV_CHUNK_SIZE || 65536) || 65536,
  };
}

function connect(options) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: options.host, port: options.port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Virus scan timed out'));
    }, options.timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function readResponse(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Virus scan response timed out'));
    }, timeoutMs);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.includes('\n') || buffer.includes('\0')) {
        clearTimeout(timer);
        resolve(buffer.toString('utf8').split('\n')[0]);
      }
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Scan a file buffer with ClamAV.
 * @returns {{ clean: boolean, message: string, provider: string, skipped: boolean }}
 */
async function scanBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    return { clean: true, message: 'Empty file — no scan required', provider: 'clamav', skipped: true };
  }

  if (!isConfigured()) {
    return {
      clean: true,
      message: 'Virus scanning not configured (set CLAMAV_HOST to enable ClamAV)',
      provider: 'clamav',
      skipped: true,
    };
  }

  const options = config();
  const socket = await connect(options);
  try {
    const prefix = Buffer.from(`zINSTREAM\0`);
    const suffix = Buffer.from(`\0`);
    socket.write(prefix);

    const chunks = Math.max(1, Math.ceil(buffer.length / options.chunkSize));
    for (let index = 0; index < chunks; index += 1) {
      const slice = buffer.slice(index * options.chunkSize, (index + 1) * options.chunkSize);
      const header = Buffer.alloc(4);
      header.writeUInt32BE(slice.length, 0);
      socket.write(Buffer.concat([header, slice]));
    }
    socket.write(suffix);

    const response = await readResponse(socket, options.timeoutMs);
    const normalized = String(response || '').trim();

    if (normalized.startsWith('stream: FOUND') || /FOUND/.test(normalized)) {
      return { clean: false, message: 'A virus or malicious signature was detected in the uploaded file', provider: 'clamav', skipped: false };
    }

    return { clean: true, message: 'No threats detected', provider: 'clamav', skipped: false };
  } finally {
    socket.destroy();
  }
}

module.exports = { scanBuffer, isConfigured };