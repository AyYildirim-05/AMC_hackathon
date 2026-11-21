import mongoose from 'mongoose';

/**
 * Opt-in MongoDB for tests: TEST_MONGODB_URI points at a server, e.g. mongodb://localhost:27017.
 * Each test file gets its own `<name>_test` database (node --test runs files in parallel, and each
 * file drops its database), overriding any database named in the URI.
 */
export const testMongoUri = process.env.TEST_MONGODB_URI;

export const connectTestDb = async (name: string) => {
  if (!testMongoUri) throw new Error('TEST_MONGODB_URI is not set');
  await mongoose.connect(testMongoUri, { dbName: `${name}_test`, serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  // Mongoose builds indexes in the background on connect; if that finished before the drop, the
  // unique indexes are gone and duplicate-key behaviour silently stops being tested.
  await mongoose.connection.syncIndexes();
};

export const dropTestDb = async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};
