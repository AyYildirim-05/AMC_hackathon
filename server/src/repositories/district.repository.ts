import { type District, DistrictModel } from '../models/index.js';

/** French collation: sorts accented names correctly; strength 1 also ignores case and accents in matches. */
const FRENCH = { locale: 'fr' } as const;
const FRENCH_LOOSE = { locale: 'fr', strength: 1 } as const;

export type NewDistrict = Pick<
  District,
  'nameFr' | 'nameEn' | 'openNorthSlug' | 'districtType' | 'isClaimed'
> & { managerId: string | null; postalCode?: string | null };

export type DistrictChanges = Partial<NewDistrict>;

export const districtExists = async (id: string) =>
  (await DistrictModel.exists({ _id: id })) !== null;

/** The district's manager id, or null when the district is unmanaged or does not exist. */
export const findDistrictManagerId = async (id: string) =>
  (await DistrictModel.findById(id, { managerId: 1 }).lean())?.managerId ?? null;

/** Id of the district this person manages, or null. A person manages at most one district. */
export const findDistrictIdManagedBy = async (personId: string) => {
  const district = await DistrictModel.findOne({ managerId: personId }, { _id: 1 }).lean();
  return district ? String(district._id) : null;
};

export const findAllDistricts = () => DistrictModel.find().sort({ nameFr: 1 }).collation(FRENCH);

export const findDistrictById = (id: string) => DistrictModel.findById(id);

// Names are not unique-indexed; if two districts share a name, the first match is returned.
export const findDistrictByName = (name: string) =>
  DistrictModel.findOne({ $or: [{ nameFr: name }, { nameEn: name }] }).collation(FRENCH_LOOSE);

/**
 * Matches an OpenNorth boundary slug or name against existing districts, handling minor French
 * article differences (e.g. OpenNorth's `plateau-mont-royal` / `Plateau-Mont-Royal` vs seeded
 * `le-plateau-mont-royal` / `Le Plateau-Mont-Royal`).
 */
export const findDistrictBySlugOrName = (slug: string, name: string) => {
  const bareSlug = slug.replace(/^(le|la|les|l)-/, '');
  const slugCandidates = Array.from(
    new Set([slug, bareSlug, `le-${bareSlug}`, `la-${bareSlug}`, `les-${bareSlug}`]),
  );
  const bareName = name.replace(/^(le |la |les |l['’])/i, '').trim();
  const nameCandidates = Array.from(
    new Set([name, bareName, `Le ${bareName}`, `La ${bareName}`, `Les ${bareName}`]),
  );

  return DistrictModel.findOne({
    $or: [
      { openNorthSlug: { $in: slugCandidates } },
      { nameFr: { $in: nameCandidates } },
      { nameEn: { $in: nameCandidates } },
    ],
  }).collation(FRENCH_LOOSE);
};

export const createDistrict = (data: NewDistrict) => DistrictModel.create(data);

/**
 * Returns the updated district, or null when no district has that id or its manager is no longer
 * `expectedManagerId` (null = unclaimed).
 */
export const updateDistrictById = (
  id: string,
  changes: DistrictChanges,
  expectedManagerId: string | null,
) =>
  DistrictModel.findOneAndUpdate(
    { _id: id, managerId: expectedManagerId },
    { $set: changes },
    { returnDocument: 'after', runValidators: true },
  );

/**
 * Returns the deleted district, or null when no district has that id or its manager is no longer
 * `expectedManagerId` (null = unmanaged).
 */
export const deleteDistrictById = (id: string, expectedManagerId: string | null) =>
  DistrictModel.findOneAndDelete({ _id: id, managerId: expectedManagerId });
