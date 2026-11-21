import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { Types } from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { DistrictModel, IssueModel, type PersonRole, PersonModel } from '../src/models/index.js';
import { updateIssueById } from '../src/repositories/issue.repository.js';

import { connectTestDb, dropTestDb, testMongoUri } from './test-db.js';

const app = createApp();
const missing = '000000000000000000000000';
type Doc = { _id: Types.ObjectId };
type PersonDoc = Doc & { role: PersonRole };
const id = (doc: Doc) => String(doc._id);
const bearer = (personId: string, role: PersonRole = 'resident') =>
  `Bearer ${signToken({ sub: personId, role, type: 'access' }, 3600)}`;
const auth = (person: PersonDoc) => bearer(id(person), person.role);

const NOT_ALLOWED_EDIT = 'Only the district manager or the issue creator can edit this issue';
const CREATOR_LOCKED = 'The creator can only edit an issue while its status is not_started';
const NOT_MANAGER = 'Only the district manager can change the status';
const finalError = (status: string) => `A ${status} issue's status cannot be changed`;

describe(
  'issue API against MongoDB',
  { skip: !testMongoUri && 'set TEST_MONGODB_URI to run' },
  () => {
    let plateau: Doc;
    let villeMarie: Doc;
    let unmanaged: Doc;
    let reporter: PersonDoc;
    let plateauMgr: PersonDoc;
    let vmMgr: PersonDoc;
    let stranger: PersonDoc;
    let admin: PersonDoc;

    const report = async (districtId: Types.ObjectId, overrides: object = {}) => {
      const res = await request(app)
        .post('/api/issues')
        .set('Authorization', auth(reporter))
        .send({
          title: 'Pothole',
          description: 'Deep pothole.',
          category: 'roads_potholes',
          address: '1250 Rue Rachel Est',
          latitude: 45.5,
          longitude: -73.5,
          districtId: String(districtId),
          ...overrides,
        });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const issue: { id: string; createdAt: string; updatedAt: string } = res.body;
      return issue;
    };
    const edit = (issueId: string, by: PersonDoc, changes: object) =>
      request(app).patch(`/api/issues/${issueId}`).set('Authorization', auth(by)).send(changes);
    const setStatus = (issueId: string, by: PersonDoc, status: string) =>
      request(app)
        .patch(`/api/issues/${issueId}/status`)
        .set('Authorization', auth(by))
        .send({ status });

    before(async () => {
      await connectTestDb('issue_api');

      [plateau, villeMarie, unmanaged] = await DistrictModel.create([
        { nameFr: 'Plateau', nameEn: 'Plateau', openNorthSlug: 'plateau', districtType: 'borough' },
        {
          nameFr: 'Ville-Marie',
          nameEn: 'Ville-Marie',
          openNorthSlug: 'ville-marie',
          districtType: 'borough',
        },
        {
          nameFr: 'Vide',
          nameEn: 'Unmanaged',
          openNorthSlug: 'unmanaged',
          districtType: 'borough',
        },
      ]);
      const person = (username: string, role: PersonRole = 'resident') => ({
        username,
        email: `${username}@example.com`,
        postalCode: 'H2J2J9',
        homeDistrictId: plateau._id,
        role,
      });
      [reporter, plateauMgr, vmMgr, stranger, admin] = await PersonModel.create([
        person('reporter'),
        person('plateau_mgr', 'district_manager'),
        person('vm_mgr', 'district_manager'),
        person('stranger'),
        person('admin', 'admin'),
      ]);
      await DistrictModel.updateOne(
        { _id: plateau._id },
        { managerId: plateauMgr._id, isClaimed: true },
      );
      await DistrictModel.updateOne(
        { _id: villeMarie._id },
        { managerId: vmMgr._id, isClaimed: true },
      );
    });

    beforeEach(async () => {
      await IssueModel.deleteMany({});
    });

    after(dropTestDb);

    describe('reportIssue', () => {
      it('creates an issue with defaults, ignoring client-set status, counters, and createdById', async () => {
        const res = await request(app)
          .post('/api/issues')
          .set('Authorization', auth(reporter))
          .send({
            title: '  Pothole  ',
            description: 'Deep pothole.',
            category: 'roads_potholes',
            address: 'a',
            latitude: 45.5,
            longitude: -73.5,
            districtId: id(plateau),
            createdById: id(stranger),
            status: 'completed',
            upvoteCount: 999,
          });
        assert.equal(res.status, 201);
        assert.equal(res.body.title, 'Pothole');
        assert.equal(res.body.createdById, id(reporter));
        assert.equal(res.body.status, 'not_started');
        assert.equal(res.body.upvoteCount, 0);
        assert.deepEqual(res.body.images, []);
        assert.ok(res.body.id && !('_id' in res.body));
        assert.ok(await IssueModel.exists({ _id: res.body.id }));
      });

      it('rejects unknown district and person ids without saving', async () => {
        const base = {
          title: 't',
          description: 'd',
          category: 'other',
          address: 'a',
          latitude: 0,
          longitude: 0,
        };
        const noDistrict = await request(app)
          .post('/api/issues')
          .set('Authorization', auth(reporter))
          .send({ ...base, districtId: missing });
        assert.deepEqual(
          [noDistrict.status, noDistrict.body],
          [400, { error: 'Unknown districtId' }],
        );
        const noPerson = await request(app)
          .post('/api/issues')
          .set('Authorization', bearer(missing))
          .send({ ...base, districtId: id(plateau) });
        assert.deepEqual(
          [noPerson.status, noPerson.body],
          [401, { error: 'Authenticated user not found' }],
        );
        assert.equal(await IssueModel.countDocuments(), 0);
      });
    });

    describe('reads', () => {
      it('lists all issues newest first, and by district', async () => {
        const older = await report(plateau._id, { title: 'Older' });
        await new Promise((r) => setTimeout(r, 5)); // distinct createdAt
        await report(villeMarie._id, { title: 'Newer' });

        const all = await request(app).get('/api/issues');
        assert.deepEqual(
          all.body.map((i: { title: string }) => i.title),
          ['Newer', 'Older'],
        );

        const inPlateau = await request(app).get(`/api/issues/district/${id(plateau)}`);
        assert.deepEqual(
          inPlateau.body.map((i: { id: string }) => i.id),
          [older.id],
        );

        const empty = await request(app).get(`/api/issues/district/${id(unmanaged)}`);
        assert.deepEqual([empty.status, empty.body], [200, []]);

        const noDistrict = await request(app).get(`/api/issues/district/${missing}`);
        assert.deepEqual(
          [noDistrict.status, noDistrict.body],
          [404, { error: 'District not found' }],
        );
      });

      it('gets one issue by id, or 404', async () => {
        const issue = await report(plateau._id);
        assert.equal((await request(app).get(`/api/issues/${issue.id}`)).body.id, issue.id);
        const res = await request(app).get(`/api/issues/${missing}`);
        assert.deepEqual([res.status, res.body], [404, { error: 'Issue not found' }]);
      });
    });

    describe('updateIssue', () => {
      it('lets the creator edit while not_started, keeping untouched fields', async () => {
        const issue = await report(plateau._id, { images: ['https://example.com/a.jpg'] });
        const res = await edit(issue.id, reporter, {
          title: '  Edited  ',
          status: 'completed',
          upvoteCount: 50,
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.title, 'Edited');
        assert.deepEqual(res.body.images, ['https://example.com/a.jpg']);
        assert.equal(res.body.description, 'Deep pothole.');
        assert.equal(res.body.status, 'not_started');
        assert.equal(res.body.upvoteCount, 0);
        assert.equal(res.body.updatedById, id(reporter));
      });

      it('matches ids regardless of hex case', async () => {
        const issue = await report(plateau._id);
        const res = await request(app)
          .patch(`/api/issues/${issue.id}`)
          .set('Authorization', bearer(id(reporter).toUpperCase(), reporter.role))
          .send({ title: 'Upper' });
        assert.equal(res.status, 200);
      });

      it('forbids anyone but the creator and the district manager', async () => {
        const issue = await report(plateau._id);
        for (const person of [vmMgr, admin, stranger]) {
          const res = await edit(issue.id, person, { title: 'x' });
          assert.deepEqual([res.status, res.body], [403, { error: NOT_ALLOWED_EDIT }]);
        }
        const res = await edit(missing, reporter, { title: 'x' });
        assert.deepEqual([res.status, res.body], [404, { error: 'Issue not found' }]);
      });

      it('locks the creator out once work starts, but not the manager', async () => {
        const issue = await report(plateau._id);
        assert.equal((await setStatus(issue.id, plateauMgr, 'in_progress')).status, 200);

        const byCreator = await edit(issue.id, reporter, { title: 'x' });
        assert.deepEqual([byCreator.status, byCreator.body], [403, { error: CREATOR_LOCKED }]);

        const byManager = await edit(issue.id, plateauMgr, { description: 'Manager note' });
        assert.equal(byManager.status, 200);
        assert.equal(byManager.body.description, 'Manager note');
        assert.equal(byManager.body.status, 'in_progress');
      });

      it('keeps createdAt, advances updatedAt on every change, and ignores client-sent timestamps', async () => {
        const forged = '2000-01-01T00:00:00.000Z';
        const created = await report(plateau._id, { createdAt: forged, updatedAt: forged });
        const { createdAt, updatedAt } = created;
        assert.notEqual(createdAt, forged);
        assert.equal(updatedAt, createdAt);

        await new Promise((r) => setTimeout(r, 5));
        const edited = await edit(created.id, reporter, {
          title: 'Edited',
          createdAt: forged,
          updatedAt: forged,
        });
        assert.equal(edited.body.createdAt, createdAt);
        assert.ok(edited.body.updatedAt > updatedAt, 'edit advances updatedAt');

        await new Promise((r) => setTimeout(r, 5));
        const started = await setStatus(created.id, plateauMgr, 'in_progress');
        assert.equal(started.body.createdAt, createdAt);
        assert.ok(
          started.body.updatedAt > edited.body.updatedAt,
          'status change advances updatedAt',
        );
      });

      it('lets the manager move the issue, which hands it to the new district manager', async () => {
        const issue = await report(plateau._id);
        const bad = await edit(issue.id, plateauMgr, { districtId: missing });
        assert.deepEqual([bad.status, bad.body], [400, { error: 'Unknown districtId' }]);

        const moved = await edit(issue.id, plateauMgr, { districtId: id(villeMarie) });
        assert.equal(moved.body.districtId, id(villeMarie));
        assert.equal((await setStatus(issue.id, plateauMgr, 'in_progress')).status, 403);
        assert.equal((await setStatus(issue.id, vmMgr, 'in_progress')).status, 200);
      });

      it('saves nothing when the status changed after the permission check', async () => {
        const issue = await report(plateau._id, { title: 'Original' });
        const stale = await updateIssueById(
          issue.id,
          { title: 'Stale', updatedById: id(reporter) },
          'in_progress',
        );
        assert.equal(stale, null);
        assert.equal((await IssueModel.findById(issue.id).lean())?.title, 'Original');
      });
    });

    describe('updateStatus', () => {
      it('allows only the manager of the issue district', async () => {
        const issue = await report(plateau._id);
        for (const person of [reporter, admin, vmMgr]) {
          const res = await setStatus(issue.id, person, 'in_progress');
          assert.deepEqual([res.status, res.body], [403, { error: NOT_MANAGER }]);
        }
        const res = await setStatus(issue.id, plateauMgr, 'in_progress');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'in_progress');
        assert.equal(res.body.updatedById, id(plateauMgr));
      });

      it('allows nobody in a district without a manager', async () => {
        const issue = await report(unmanaged._id);
        const res = await setStatus(issue.id, plateauMgr, 'in_progress');
        assert.deepEqual([res.status, res.body], [403, { error: NOT_MANAGER }]);
      });

      it('moves freely between open statuses', async () => {
        const issue = await report(plateau._id);
        for (const status of ['postponed', 'in_progress', 'not_started', 'in_progress']) {
          assert.equal((await setStatus(issue.id, plateauMgr, status)).status, 200, status);
        }
      });

      it('treats completed and cancelled as final', async () => {
        for (const closed of ['completed', 'cancelled']) {
          const issue = await report(plateau._id);
          assert.equal((await setStatus(issue.id, plateauMgr, closed)).status, 200);
          for (const next of [
            'not_started',
            'in_progress',
            closed === 'completed' ? 'cancelled' : 'completed',
          ]) {
            const res = await setStatus(issue.id, plateauMgr, next);
            assert.deepEqual(
              [res.status, res.body],
              [409, { error: finalError(closed) }],
              `${closed} -> ${next}`,
            );
          }
          assert.equal(
            (await setStatus(issue.id, plateauMgr, closed)).status,
            200,
            'same status is a no-op',
          );
          // Non-managers get the permission error, not the transition error.
          assert.equal((await setStatus(issue.id, reporter, 'not_started')).status, 403);
          assert.equal((await IssueModel.findById(issue.id).lean())?.status, closed);
        }
      });

      it('returns 404 for an unknown issue', async () => {
        const res = await setStatus(missing, plateauMgr, 'completed');
        assert.deepEqual([res.status, res.body], [404, { error: 'Issue not found' }]);
      });
    });
  },
);
