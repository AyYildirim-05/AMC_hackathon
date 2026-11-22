import { PersonModel } from '../models/index.js';

export const personExists = async (id: string) => (await PersonModel.exists({ _id: id })) !== null;

/** The person's role, or null when no person has that id. */
export const findPersonRole = async (id: string) =>
  (await PersonModel.findById(id, { role: 1 }).lean())?.role ?? null;

export const districtHasResidents = async (districtId: string) =>
  (await PersonModel.exists({ homeDistrictId: districtId })) !== null;

export const findPersonById = (id: string) => PersonModel.findById(id);

export const findPersonsByIds = (ids: string[]) => {
  if (ids.length === 0) return Promise.resolve([]);
  return PersonModel.find({ _id: { $in: ids } });
};
