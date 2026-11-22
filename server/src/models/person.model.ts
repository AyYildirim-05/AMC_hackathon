import { type InferSchemaType, Schema, model } from 'mongoose';

export const PERSON_ROLES = ['resident', 'district_manager', 'admin'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const PREFERRED_LANGUAGES = ['fr', 'en'] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

const personSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, maxlength: 50, unique: true },
    displayName: { type: String, trim: true, maxlength: 100, default: '' },
    avatarUrl: { type: String, trim: true, default: null },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
      unique: true,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
    },
    homeDistrictId: { type: Schema.Types.ObjectId, ref: 'District', default: null },
    role: { type: String, required: true, enum: PERSON_ROLES, default: 'resident' },
    isVerified: { type: Boolean, required: true, default: false },
    isActivePost: { type: Boolean, required: true, default: false },
    preferredLanguage: { type: String, required: true, enum: PREFERRED_LANGUAGES, default: 'fr' },
  },
  {
    collection: 'persons',
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        if (!ret.displayName) {
          ret.displayName = ret.username;
        }
        ret.avatarUrl = ret.avatarUrl ?? null;
        ret.isVerified = Boolean(ret.isVerified);
        ret.isActivePost = Boolean(ret.isActivePost);
        ret.homeDistrictId = ret.homeDistrictId ? String(ret.homeDistrictId) : null;
        return ret;
      },
    },
  },
);

personSchema.index({ homeDistrictId: 1 }, { name: 'idx_persons_home_district' });

export type Person = InferSchemaType<typeof personSchema>;
export const PersonModel = model('Person', personSchema);
