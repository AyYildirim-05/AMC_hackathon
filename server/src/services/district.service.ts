import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { objectId } from '../lib/object-id.js';
import { DISTRICT_TYPES } from '../models/index.js';
import {
  createDistrict as insertDistrict,
  deleteDistrictById,
  findAllDistricts,
  findDistrictById,
  findDistrictByName,
  findDistrictIdManagedBy,
  updateDistrictById,
} from '../repositories/district.repository.js';
import { districtHasIssues } from '../repositories/issue.repository.js';
import {
  districtHasResidents,
  findPersonRole,
  findPersonsByIds,
} from '../repositories/person.repository.js';

export const districtIdParams = z.object({ id: objectId });
export const districtNameParams = z.object({ name: z.string().trim().min(1).max(120) });

const districtFields = {
  nameFr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  openNorthSlug: z.string().trim().min(1).max(100),
  districtType: z.enum(DISTRICT_TYPES),
  postalCode: z.string().trim().max(10).nullable().optional(),
};
/** A district_manager's id, or null for no manager. Only an admin may set it. */
const managerId = objectId.nullable();

// No auth yet: the client says who is acting.
const actor = { actorId: objectId };

/** isClaimed is never accepted: it is derived from managerId so the two cannot disagree. */
export const createDistrictInput = z.object({
  ...districtFields,
  managerId: managerId.default(null),
  ...actor,
});
export type CreateDistrictInput = z.infer<typeof createDistrictInput>;

// No default on managerId here: a default inside the partial update schema would unassign the
// manager on every edit.
export const updateDistrictInput = z
  .object({ ...districtFields, managerId })
  .partial()
  .extend(actor)
  .refine(({ actorId: _, ...changes }) => Object.keys(changes).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateDistrictInput = z.infer<typeof updateDistrictInput>;

export const deleteDistrictInput = z.object(actor);
export type DeleteDistrictInput = z.infer<typeof deleteDistrictInput>;

const orNotFound = <T>(district: T | null): T => {
  if (!district) throw new HttpError(404, 'District not found');
  return district;
};

const isAdmin = async (personId: string) => (await findPersonRole(personId)) === 'admin';

const assertIsAdmin = async (personId: string, action: string) => {
  if (!(await isAdmin(personId))) throw new HttpError(403, `Only an admin can ${action}`);
};

/** The district's manager may edit or delete it; an admin may too while it has no manager. */
const isDistrictOwner = async (currentManagerId: string | null, actorId: string) =>
  currentManagerId === null ? isAdmin(actorId) : currentManagerId === actorId;

/**
 * The new manager must be a district_manager who manages no other district (one-to-one).
 * The unique index on districts.managerId backs this up against concurrent assignments.
 */
const assertAssignableManager = async (personId: string, districtId?: string) => {
  if ((await findPersonRole(personId)) !== 'district_manager') {
    throw new HttpError(400, 'managerId must be a district_manager');
  }
  const managed = await findDistrictIdManagedBy(personId);
  if (managed !== null && managed !== districtId) {
    throw new HttpError(409, 'This manager already manages another district');
  }
};

type SerializableDoc = { toJSON: () => Record<string, unknown> };

async function enrichDistricts(docs: readonly SerializableDoc[]) {
  if (docs.length === 0) return [];
  const rawDistricts = docs.map((doc) => doc.toJSON());
  const managerIds = Array.from(
    new Set(rawDistricts.map((d) => d.managerId).filter((id): id is string => Boolean(id))),
  );
  const managers = await findPersonsByIds(managerIds);
  const usernameById = new Map(
    managers.map((m) => {
      const json = m.toJSON() as Record<string, unknown>;
      return [String(json.id), String(json.username)] as const;
    }),
  );

  return rawDistricts.map((district) => ({
    ...district,
    managerUsername: district.managerId
      ? (usernameById.get(String(district.managerId)) ?? null)
      : null,
  }));
}

async function enrichDistrict(doc: SerializableDoc) {
  const [enriched] = await enrichDistricts([doc]);
  return enriched;
}

export const allDistricts = async () => enrichDistricts(await findAllDistricts());

export const districtById = async (id: string) =>
  enrichDistrict(orNotFound(await findDistrictById(id)));

export const districtByName = async (name: string) =>
  enrichDistrict(orNotFound(await findDistrictByName(name)));

export const createDistrict = async ({ actorId, ...fields }: CreateDistrictInput) => {
  await assertIsAdmin(actorId, 'create a district');
  if (fields.managerId) await assertAssignableManager(fields.managerId);
  const created = await insertDistrict({ ...fields, isClaimed: fields.managerId !== null });
  return enrichDistrict(created);
};

/**
 * Assigning, changing or removing the manager is for an admin. Editing the other fields is for the
 * district's own manager, or an admin while it has no manager.
 */
export const updateDistrict = async (id: string, { actorId, ...changes }: UpdateDistrictInput) => {
  const district = orNotFound(await findDistrictById(id));
  const currentManagerId = district.managerId === null ? null : String(district.managerId);
  const { managerId: newManagerId, ...details } = changes;

  if (newManagerId !== undefined) {
    await assertIsAdmin(actorId, 'assign a district manager');
    if (newManagerId !== null) await assertAssignableManager(newManagerId, id);
  }
  if (Object.keys(details).length > 0 && !(await isDistrictOwner(currentManagerId, actorId))) {
    throw new HttpError(403, 'Only the district manager can edit this district');
  }

  const withClaim =
    newManagerId === undefined ? changes : { ...changes, isClaimed: newManagerId !== null };
  // Conditional on the manager we checked, so a concurrent reassignment cannot be overwritten.
  const updated = await updateDistrictById(id, withClaim, currentManagerId);
  if (!updated) throw new HttpError(409, 'District changed while saving; reload and retry');
  return enrichDistrict(updated);
};

/**
 * The district's manager may delete it (an admin, while it has no manager), and only once no issue
 * or resident points at it.
 * The reference check is not atomic: a reference created between the check and the delete is not
 * caught. Closing that gap needs a transaction (requires a replica set).
 */
export const deleteDistrict = async (id: string, { actorId }: DeleteDistrictInput) => {
  const district = orNotFound(await findDistrictById(id));
  const currentManagerId = district.managerId === null ? null : String(district.managerId);
  if (!(await isDistrictOwner(currentManagerId, actorId))) {
    throw new HttpError(403, 'Only the district manager can delete this district');
  }
  const [hasIssues, hasResidents] = await Promise.all([
    districtHasIssues(id),
    districtHasResidents(id),
  ]);
  if (hasIssues) throw new HttpError(409, 'District still has issues; move or delete them first');
  if (hasResidents) throw new HttpError(409, 'District is still a home district for residents');
  if (!(await deleteDistrictById(id, currentManagerId))) {
    throw new HttpError(409, 'District changed while deleting; reload and retry');
  }
};
