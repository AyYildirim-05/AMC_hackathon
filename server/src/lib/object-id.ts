import { z } from 'zod';

// A 24-hex-char string. mongoose.isValidObjectId also accepts any 12-char string, so it's too loose here.
// Lower-cased so it compares equal to ObjectId#toString() in permission checks.
export const objectId = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Invalid ObjectId')
  .toLowerCase();
