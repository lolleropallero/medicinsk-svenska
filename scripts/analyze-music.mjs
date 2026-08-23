import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('src/assets/audio/music');
const files = Array.from({ length: 5 }, (_, index) => `music-${String(index + 1).padStart(2, '0')}.mp3`);
const server = createServer((request, response) => {
  const name = basename(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
  if (!files.includes(name)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': extname(name) === '.mp3' ? 'audio/mpeg' : 'application/octet-stream', 'access-control-allow-origin': '*' });
  response.end(readFileSync(join(root, name)));
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const analysis = await page.evaluate(async ({ base, names }) => {
    const context = new AudioContext();
    const output = [];
    for (const name of names) {
      const bytes = await (await fetch(`${base}/${name}`)).arrayBuffer();
      const decoded = await context.decodeAudioData(bytes);
      const offline = new OfflineAudioContext(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      const shelf = offline.createBiquadFilter();
      shelf.type = 'highshelf'; shelf.frequency.value = 1681.974; shelf.gain.value = 4;
      const highpass = offline.createBiquadFilter();
      highpass.type = 'highpass'; highpass.frequency.value = 38.135; highpass.Q.value = .5;
      source.connect(shelf).connect(highpass).connect(offline.destination); source.start();
      const weighted = await offline.startRendering();
      let peak = 0;
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const data = decoded.getChannelData(channel);
        for (let index = 0; index < data.length; index++) peak = Math.max(peak, Math.abs(data[index]));
      }
      const block = Math.round(decoded.sampleRate * .4), step = Math.round(decoded.sampleRate * .1), energies = [];
      for (let start = 0; start + block <= weighted.length; start += step) {
        let sum = 0;
        for (let channel = 0; channel < weighted.numberOfChannels; channel++) {
          const data = weighted.getChannelData(channel);
          for (let index = start; index < start + block; index++) sum += data[index] * data[index];
        }
        const energy = sum / block;
        if (-.691 + 10 * Math.log10(energy) > -70) energies.push(energy);
      }
      const preliminary = energies.reduce((sum, value) => sum + value, 0) / energies.length;
      const relativeGate = -.691 + 10 * Math.log10(preliminary) - 10;
      const gated = energies.filter((energy) => -.691 + 10 * Math.log10(energy) > relativeGate);
      const integrated = -.691 + 10 * Math.log10(gated.reduce((sum, value) => sum + value, 0) / gated.length);
      output.push({ name, duration: decoded.duration, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels,
        integratedLufsApprox: integrated, samplePeakDbfs: 20 * Math.log10(peak) });
    }
    await context.close();
    return output;
  }, { base: `http://127.0.0.1:${port}`, names: files });
  console.log(JSON.stringify(analysis, null, 2));
} finally {
  await browser.close();
  server.close();
}
