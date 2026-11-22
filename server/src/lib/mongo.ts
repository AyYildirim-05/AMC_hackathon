import mongoose from 'mongoose';

const defaultMongoUri = () =>
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  'mongodb://localhost:27017/montreal_issues';

function hasExplicitDbName(uri: string): boolean {
  try {
    return new URL(uri).pathname.replace(/^\/+/, '').length > 0;
  } catch {
    return false;
  }
}

export async function connectMongo(uri = defaultMongoUri()): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  const dbName =
    process.env.MONGODB_DB_NAME?.trim() || (hasExplicitDbName(uri) ? undefined : 'montreal_issues');
  await mongoose.connect(uri, { ...(dbName ? { dbName } : {}), serverSelectionTimeoutMS: 5_000 });
  console.log(`[mongo] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

/** Round-trips to the server; throws if MongoDB is unreachable. */
export async function pingMongo(): Promise<void> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !db) throw new Error('MongoDB is not connected');
  await db.admin().ping();
}
