import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { Types } from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { DistrictModel, IssueModel, type PersonRole, PersonModel } from '../src/models/index.js';
import { deleteDistrictById, updateDistrictById } from '../src/repositories/district.repository.js';

import { connectTestDb, dropTestDb, testMongoUri } from './test-db.js';

const app = createApp();
const missing = '000000000000000000000000';
type Doc = { _id: Types.ObjectId };
type PersonDoc = Doc & { role: PersonRole };
const id = (doc: Doc) => String(doc._id);
const bearer = (personId: string, role: PersonRole = 'resident') =>
  `Bearer ${signToken({ sub: personId, role, type: 'access' }, 3600)}`;
const auth = (person: PersonDoc) => bearer(id(person), person.role);
type DistrictJson = { id: string; nameFr: string; managerId: string | null; isClaimed: boolean };

const NOT_ADMIN_CREATE = 'Only an admin can create a district';
const NOT_ADMIN_ASSIGN = 'Only an admin can assign a district manager';
const NOT_MANAGER_EDIT = 'Only the district manager can edit this district';
const NOT_MANAGER_DELETE = 'Only the district manager can delete this district';
const ALREADY_MANAGES = 'This manager already manages another district';

describe(
  'district API against MongoDB',
  { skip: !testMongoUri && 'set TEST_MONGODB_URI to run' },
  () => {
    let admin: PersonDoc;
    let manager: PersonDoc;
    let otherManager: PersonDoc;
    let resident: PersonDoc;

    const fields = (slug: string, overrides: object = {}) => ({
      nameFr: `Nom ${slug}`,
      nameEn: `Name ${slug}`,
      openNorthSlug: slug,
      districtType: 'borough' as const,
      ...overrides,
    });
    const post = (by: PersonDoc, slug: string, overrides: object = {}) =>
      request(app)
        .post('/api/districts')
        .set('Authorization', auth(by))
        .send(fields(slug, overrides));
    /** Created by the admin; pass `{ managerId }` to assign a manager at creation. */
    const create = async (slug: string, overrides: object = {}) => {
      const res = await post(admin, slug, overrides);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const district: DistrictJson = res.body;
      return district;
    };
    const patch = (districtId: string, by: PersonDoc, changes: object) =>
      request(app)
        .patch(`/api/districts/${districtId}`)
        .set('Authorization', auth(by))
        .send(changes);
    const remove = (districtId: string, by: PersonDoc) =>
      request(app).delete(`/api/districts/${districtId}`).set('Authorization', auth(by));

    before(async () => {
      await connectTestDb('district_api');
      // People need a home district; this one is never deleted by the tests.
      const home = await DistrictModel.create(fields('home'));
      const person = (username: string, role: PersonRole) => ({
        username,
        email: `${username}@example.com`,
        postalCode: 'H2J2J9',
        homeDistrictId: home._id,
        role,
      });
      [admin, manager, otherManager, resident] = await PersonModel.create([
        person('admin', 'admin'),
        person('manager', 'district_manager'),
        person('other_manager', 'district_manager'),
        person('resident', 'resident'),
      ]);
    });

    beforeEach(async () => {
      await IssueModel.deleteMany({});
      await DistrictModel.deleteMany({ openNorthSlug: { $ne: 'home' } });
    });

    after(dropTestDb);

    describe('createDistrict', () => {
      it('lets an admin create an unmanaged district, ignoring a client-sent isClaimed', async () => {
        const district = await create('plateau', { nameFr: '  Le Plateau  ', isClaimed: true });
        assert.equal(district.nameFr, 'Le Plateau');
        assert.deepEqual([district.managerId, district.isClaimed], [null, false]);
        assert.ok(district.id && !('_id' in district));
      });

      it('lets an admin assign a manager at creation', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        assert.deepEqual([district.managerId, district.isClaimed], [id(manager), true]);
      });

      it('forbids anyone who is not an admin', async () => {
        for (const actor of [manager, resident]) {
          const res = await post(actor, 'x');
          assert.deepEqual([res.status, res.body], [403, { error: NOT_ADMIN_CREATE }]);
        }
        const unknown = await request(app)
          .post('/api/districts')
          .set('Authorization', bearer(missing, 'admin'))
          .send(fields('x'));
        assert.equal(unknown.status, 403);
        assert.equal(await DistrictModel.countDocuments({ openNorthSlug: 'x' }), 0);
      });

      it('rejects a manager who is not a district_manager, or who already manages a district', async () => {
        const notManager = await post(admin, 'a', { managerId: id(resident) });
        assert.deepEqual(
          [notManager.status, notManager.body],
          [400, { error: 'managerId must be a district_manager' }],
        );
        await create('plateau', { managerId: id(manager) });
        const taken = await post(admin, 'b', { managerId: id(manager) });
        assert.deepEqual([taken.status, taken.body], [409, { error: ALREADY_MANAGES }]);
        assert.equal(await DistrictModel.countDocuments({ openNorthSlug: { $in: ['a', 'b'] } }), 0);
      });

      it('rejects a duplicate openNorthSlug with 409', async () => {
        await create('plateau');
        const res = await post(admin, 'plateau');
        assert.deepEqual(
          [res.status, res.body],
          [409, { error: 'Duplicate value', details: { openNorthSlug: 'plateau' } }],
        );
      });
    });

    describe('reads', () => {
      it('lists all districts in French alphabetical order', async () => {
        for (const nameFr of ['Lachine', 'Île-Bizard', 'Anjou'])
          await create(nameFr.toLowerCase(), { nameFr });
        const res = await request(app).get('/api/districts');
        // Binary order would put "Île-Bizard" last; French collation puts it between A and L.
        assert.deepEqual(
          res.body.map((d: DistrictJson) => d.nameFr),
          ['Anjou', 'Île-Bizard', 'Lachine', 'Nom home'],
        );
      });

      it('gets one district by id, or 404', async () => {
        const district = await create('plateau');
        assert.equal(
          (await request(app).get(`/api/districts/${district.id}`)).body.id,
          district.id,
        );
        const res = await request(app).get(`/api/districts/${missing}`);
        assert.deepEqual([res.status, res.body], [404, { error: 'District not found' }]);
      });

      it('finds a district by French or English name, ignoring case and accents', async () => {
        const district = await create('mtl-nord', {
          nameFr: 'Montréal-Nord',
          nameEn: 'Montreal North',
        });
        for (const name of ['Montréal-Nord', 'montreal-nord', 'MONTREAL NORTH']) {
          const res = await request(app).get(`/api/districts/name/${encodeURIComponent(name)}`);
          assert.equal(res.status, 200, name);
          assert.equal(res.body.id, district.id, name);
        }
        const partial = await request(app).get('/api/districts/name/Montr');
        assert.deepEqual([partial.status, partial.body], [404, { error: 'District not found' }]);
      });
    });

    describe('updateDistrict: details', () => {
      it('lets the district manager make a partial update without touching other fields', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        const res = await patch(district.id, manager, { nameEn: 'Plateau' });
        assert.equal(res.status, 200);
        assert.equal(res.body.nameEn, 'Plateau');
        assert.equal(res.body.nameFr, 'Nom plateau');
        assert.deepEqual([res.body.managerId, res.body.isClaimed], [id(manager), true]);
      });

      it('forbids everyone else on a managed district, including the admin', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        for (const actor of [admin, otherManager, resident]) {
          const res = await patch(district.id, actor, { nameFr: 'x' });
          assert.deepEqual([res.status, res.body], [403, { error: NOT_MANAGER_EDIT }]);
        }
      });

      it('lets only the admin edit an unmanaged district', async () => {
        const unmanaged = await create('westmount');
        for (const actor of [manager, resident]) {
          const res = await patch(unmanaged.id, actor, { nameFr: 'x' });
          assert.deepEqual([res.status, res.body], [403, { error: NOT_MANAGER_EDIT }]);
        }
        const res = await patch(unmanaged.id, admin, { nameFr: 'Westmount' });
        assert.deepEqual(
          [res.status, res.body.nameFr, res.body.managerId],
          [200, 'Westmount', null],
        );
      });

      it('rejects a duplicate slug with 409 and an unknown district with 404', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        await create('anjou');
        assert.equal((await patch(district.id, manager, { openNorthSlug: 'anjou' })).status, 409);
        const res = await patch(missing, manager, { nameFr: 'x' });
        assert.deepEqual([res.status, res.body], [404, { error: 'District not found' }]);
      });
    });

    describe('updateDistrict: manager assignment', () => {
      it('lets the admin assign, reassign and remove the manager, keeping isClaimed in step', async () => {
        const district = await create('plateau');
        const assigned = await patch(district.id, admin, { managerId: id(manager) });
        assert.deepEqual(
          [assigned.status, assigned.body.managerId, assigned.body.isClaimed],
          [200, id(manager), true],
        );

        const reassigned = await patch(district.id, admin, { managerId: id(otherManager) });
        assert.equal(reassigned.body.managerId, id(otherManager));
        assert.equal(
          (await patch(district.id, manager, { nameFr: 'x' })).status,
          403,
          'old manager lost rights',
        );
        assert.equal(
          (await patch(district.id, otherManager, { nameFr: 'x' })).status,
          200,
          'new manager has them',
        );

        const removed = await patch(district.id, admin, { managerId: null });
        assert.deepEqual([removed.body.managerId, removed.body.isClaimed], [null, false]);
      });

      it('forbids anyone but the admin, including the current manager and self-claims', async () => {
        const managed = await create('plateau', { managerId: id(manager) });
        const unmanaged = await create('rosemont');
        const attempts: [string, PersonDoc, string | null][] = [
          [managed.id, manager, id(otherManager)], // handing over
          [managed.id, manager, null], // releasing
          [unmanaged.id, otherManager, id(otherManager)], // claiming
          [unmanaged.id, resident, id(otherManager)],
        ];
        for (const [districtId, actor, managerId] of attempts) {
          const res = await patch(districtId, actor, { managerId });
          assert.deepEqual([res.status, res.body], [403, { error: NOT_ADMIN_ASSIGN }]);
        }
        const stored = await DistrictModel.find({ _id: { $in: [managed.id, unmanaged.id] } })
          .sort({ openNorthSlug: 1 })
          .lean();
        assert.deepEqual(
          stored.map((d) => d.managerId && String(d.managerId)),
          [id(manager), null],
        );
      });

      it('refuses mixing an assignment with a detail edit on a managed district', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        for (const actor of [admin, manager]) {
          const res = await patch(district.id, actor, { managerId: id(otherManager), nameFr: 'x' });
          assert.equal(res.status, 403, id(actor));
        }
      });

      it('lets the admin assign a manager and edit details together on an unmanaged district', async () => {
        const unmanaged = await create('rosemont');
        const res = await patch(unmanaged.id, admin, {
          managerId: id(manager),
          nameFr: 'Rosemont',
        });
        assert.deepEqual(
          [res.status, res.body.nameFr, res.body.managerId],
          [200, 'Rosemont', id(manager)],
        );
      });

      it('keeps the one-to-one rule: a manager cannot be assigned a second district', async () => {
        await create('plateau', { managerId: id(manager) });
        const other = await create('anjou');
        const res = await patch(other.id, admin, { managerId: id(manager) });
        assert.deepEqual([res.status, res.body], [409, { error: ALREADY_MANAGES }]);
        // Re-assigning a manager to the district they already manage is fine.
        const plateau = await DistrictModel.findOne({ openNorthSlug: 'plateau' });
        assert.ok(plateau);
        assert.equal((await patch(id(plateau), admin, { managerId: id(manager) })).status, 200);
      });

      it('enforces one-to-one in the database too, for writes that skip the service check', async () => {
        await create('plateau', { managerId: id(manager) });
        await assert.rejects(
          DistrictModel.create({ ...fields('race'), managerId: manager._id, isClaimed: true }),
          (err: { code?: number }) => err.code === 11000,
        );
        // Any number of districts can still be unmanaged.
        await DistrictModel.create([fields('u1'), fields('u2')]);
      });

      it('rejects a non-district_manager, and saves nothing when the manager changed concurrently', async () => {
        const district = await create('plateau');
        const res = await patch(district.id, admin, { managerId: id(resident) });
        assert.deepEqual(
          [res.status, res.body],
          [400, { error: 'managerId must be a district_manager' }],
        );

        await patch(district.id, admin, { managerId: id(manager) });
        // A second assignment that checked "unmanaged" before the first one landed.
        const stale = await updateDistrictById(
          district.id,
          { managerId: id(otherManager), isClaimed: true },
          null,
        );
        assert.equal(stale, null);
        assert.equal(
          String((await DistrictModel.findById(district.id).lean())?.managerId),
          id(manager),
        );
      });
    });

    describe('deleteDistrict', () => {
      it('lets the manager delete an unused district', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        assert.equal((await remove(district.id, manager)).status, 204);
        assert.equal((await request(app).get(`/api/districts/${district.id}`)).status, 404);
        assert.equal((await remove(district.id, manager)).status, 404);
      });

      it('forbids everyone else on a managed district, including the admin', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        for (const actor of [admin, otherManager, resident]) {
          const res = await remove(district.id, actor);
          assert.deepEqual([res.status, res.body], [403, { error: NOT_MANAGER_DELETE }]);
        }
        assert.ok(await DistrictModel.exists({ _id: district.id }));
      });

      it('lets only the admin delete an unmanaged district', async () => {
        const unmanaged = await create('westmount');
        for (const actor of [manager, resident]) {
          const res = await remove(unmanaged.id, actor);
          assert.deepEqual([res.status, res.body], [403, { error: NOT_MANAGER_DELETE }]);
        }
        assert.equal((await remove(unmanaged.id, admin)).status, 204);
        assert.equal(await DistrictModel.exists({ _id: unmanaged.id }), null);
      });

      it('does not delete when a manager was assigned after the permission check', async () => {
        const unmanaged = await create('westmount');
        await patch(unmanaged.id, admin, { managerId: id(manager) });
        // A delete that checked "unmanaged" before the assignment landed.
        assert.equal(await deleteDistrictById(unmanaged.id, null), null);
        assert.ok(await DistrictModel.exists({ _id: unmanaged.id }));
      });

      it('refuses while issues reference the district', async () => {
        const district = await create('plateau', { managerId: id(manager) });
        await IssueModel.create({
          title: 't',
          description: 'd',
          category: 'other',
          address: 'a',
          latitude: 0,
          longitude: 0,
          districtId: district.id,
          createdById: resident._id,
        });
        const res = await remove(district.id, manager);
        assert.deepEqual(
          [res.status, res.body],
          [409, { error: 'District still has issues; move or delete them first' }],
        );
        assert.ok(await DistrictModel.exists({ _id: district.id }));
      });

      it('refuses while residents have it as their home district', async () => {
        const home = await DistrictModel.findOneAndUpdate(
          { openNorthSlug: 'home' },
          { managerId: manager._id, isClaimed: true },
          { returnDocument: 'after' },
        );
        assert.ok(home);
        try {
          const res = await remove(id(home), manager);
          assert.deepEqual(
            [res.status, res.body],
            [409, { error: 'District is still a home district for residents' }],
          );
          assert.ok(await DistrictModel.exists({ _id: home._id }));
        } finally {
          await DistrictModel.updateOne({ _id: home._id }, { managerId: null, isClaimed: false });
        }
      });
    });
  },
);
