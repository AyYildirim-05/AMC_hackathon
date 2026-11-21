import { type InferSchemaType, Schema, model } from 'mongoose';

export const DISTRICT_TYPES = ['borough', 'municipality'] as const;
export type DistrictType = (typeof DISTRICT_TYPES)[number];

const districtSchema = new Schema(
  {
    nameFr: { type: String, required: true, trim: true, maxlength: 120 },
    nameEn: { type: String, required: true, trim: true, maxlength: 120 },
    openNorthSlug: { type: String, required: true, trim: true, maxlength: 100 },
    districtType: { type: String, required: true, enum: DISTRICT_TYPES },
    managerId: { type: Schema.Types.ObjectId, ref: 'Person', default: null },
    isClaimed: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'districts',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

districtSchema.index({ openNorthSlug: 1 }, { unique: true, name: 'idx_districts_open_north_slug' });

export type District = InferSchemaType<typeof districtSchema>;
export const DistrictModel = model('District', districtSchema);
