import { createApp } from './app.js';
import { connectMongo, disconnectMongo } from './lib/mongo.js';

const port = Number(process.env.PORT ?? 4000);

await connectMongo();

const server = createApp().listen(port, () => {
  console.log(`[express] listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`[express] ${signal} received, shutting down`);
  server.close();
  await disconnectMongo();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
