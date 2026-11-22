import { HttpError } from '../lib/http-error.js';
import {
  findAllComments,
  findCommentsByIssueIds,
  findCommentsByUser,
} from '../repositories/comment.repository.js';
import { findAllDistricts } from '../repositories/district.repository.js';
import {
  findAllIssues,
  findIssuesByCreator,
  findIssuesByDistrict,
} from '../repositories/issue.repository.js';
import { findPersonById, findPersonsByIds } from '../repositories/person.repository.js';
import { findVotesByUser } from '../repositories/vote.repository.js';
import { enrichIssues } from './issue.service.js';

/**
 * Returns all live data needed by the signed-in user's role-specific profile view
 * (resident, district_manager, or admin) in one request.
 */
export async function getProfileDataForUser(userId: string) {
  const personDoc = await findPersonById(userId);
  if (!personDoc) throw new HttpError(401, 'Account not found');

  const person = personDoc.toJSON() as Record<string, unknown>;
  const role = String(person.role);
  const [districtDocs, voteDocs] = await Promise.all([findAllDistricts(), findVotesByUser(userId)]);

  const districts = districtDocs.map((d) => d.toJSON() as Record<string, unknown>);
  const managedDistrict = districts.find((d) => d.managerId === String(person.id)) ?? null;

  let issueDocs;
  if (role === 'admin') {
    issueDocs = await findAllIssues();
  } else if (role === 'district_manager' && managedDistrict) {
    issueDocs = await findIssuesByDistrict(String(managedDistrict.id));
  } else {
    issueDocs = await findIssuesByCreator(userId);
  }

  const issues = await enrichIssues(issueDocs);
  const issueIds = issues.map((i) => i.id);

  let commentDocs;
  if (role === 'admin') {
    commentDocs = await findAllComments();
  } else if (role === 'district_manager' && managedDistrict) {
    commentDocs = await findCommentsByIssueIds(issueIds);
  } else {
    commentDocs = await findCommentsByUser(userId);
  }

  const comments = commentDocs.map((c) => c.toJSON() as Record<string, unknown>);
  const votes = voteDocs.map((v) => v.toJSON() as Record<string, unknown>);

  // Gather all referenced persons (self, district managers, issue creators).
  const personIds = new Set<string>([String(person.id)]);
  for (const d of districts) {
    if (d.managerId) personIds.add(String(d.managerId));
  }
  for (const i of issues) {
    if (i.createdById) personIds.add(String(i.createdById));
  }
  const relatedPersons = (await findPersonsByIds(Array.from(personIds))).map(
    (p) => p.toJSON() as Record<string, unknown>,
  );

  return {
    person,
    persons: relatedPersons,
    districts,
    issues,
    comments,
    votes,
  };
}
