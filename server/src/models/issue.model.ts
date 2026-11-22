import { type InferSchemaType, Schema, model } from 'mongoose';

export const ISSUE_CATEGORIES = [
  'roads_potholes',
  'snow_ice',
  'trash_cleanliness',
  'parks_trees',
  'traffic_safety',
  'streetlights_utilities',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_STATUSES = [
  'not_started',
  'in_progress',
  'resolved',
  'postponed',
  'completed',
  'cancelled',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const WEATHER_ELEMENTS = [
  'snow_ice',
  'rain_flooding',
  'high_wind',
  'freezing_rain',
  'extreme_heat',
] as const;
export type WeatherElement = (typeof WEATHER_ELEMENTS)[number];

const issueSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: ISSUE_CATEGORIES },
    status: { type: String, required: true, enum: ISSUE_STATUSES, default: 'not_started' },
    elements: { type: [String], enum: WEATHER_ELEMENTS, required: true, default: [] },
    images: { type: [String], required: true, default: [] },
    address: { type: String, required: true, trim: true, maxlength: 255 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    districtId: { type: Schema.Types.ObjectId, ref: 'District', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    updatedById: { type: Schema.Types.ObjectId, ref: 'Person', default: null },
    upvoteCount: { type: Number, required: true, default: 0, min: 0 },
    resolutionConfirmations: { type: Number, required: true, default: 0, min: 0 },
    external311Ref: { type: String, trim: true, maxlength: 50, default: null },
  },
  {
    collection: 'issues',
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        ret.districtId = ret.districtId ? String(ret.districtId) : ret.districtId;
        ret.createdById = ret.createdById ? String(ret.createdById) : ret.createdById;
        ret.updatedById = ret.updatedById ? String(ret.updatedById) : null;
        ret.external311Ref = ret.external311Ref ?? null;
        ret.elements = Array.isArray(ret.elements) ? ret.elements : [];
        return ret;
      },
    },
  },
);

issueSchema.index({ districtId: 1, status: 1 }, { name: 'idx_issues_district_status' });
issueSchema.index({ category: 1 }, { name: 'idx_issues_category' });
issueSchema.index({ latitude: 1, longitude: 1 }, { name: 'idx_issues_geo' });
issueSchema.index({ createdById: 1 }, { name: 'idx_issues_created_by' });

export type Issue = InferSchemaType<typeof issueSchema>;
export const IssueModel = model('Issue', issueSchema);
