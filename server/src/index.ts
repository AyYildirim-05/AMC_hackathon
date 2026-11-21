import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo, disconnectMongo } from './lib/mongo.js';

await connectMongo();

const server = createApp().listen(env.PORT, () => {
  console.log(`[express] listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[express] ${signal} received, shutting down`);
  server.close();
  await disconnectMongo();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
