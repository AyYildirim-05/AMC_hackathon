import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { Types } from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import {
  DistrictModel,
  IssueCommentModel,
  IssueModel,
  IssueVoteModel,
  type PersonRole,
  PersonModel,
} from '../src/models/index.js';

import { connectTestDb, dropTestDb, testMongoUri } from './test-db.js';

const app = createApp();
type Doc = { _id: Types.ObjectId };
const id = (doc: Doc) => String(doc._id);
const tokenFor = (doc: Doc, role: PersonRole) =>
  `Bearer ${signToken({ sub: id(doc), role, type: 'access' }, 300)}`;

describe(
  'comments, votes, enrichment, and profile API against MongoDB',
  { skip: !testMongoUri && 'set TEST_MONGODB_URI to run' },
  () => {
    let plateau: Doc;
    let resident: Doc;
    let manager: Doc;
    let admin: Doc;

    before(async () => {
      await connectTestDb('comments_votes_profile');
      plateau = await DistrictModel.create({
        nameFr: 'Le Plateau-Mont-Royal',
        nameEn: 'Le Plateau-Mont-Royal',
        openNorthSlug: 'le-plateau-mont-royal',
        districtType: 'borough',
        postalCode: 'H2J 1S4',
      });
      [resident, manager, admin] = await PersonModel.create([
        {
          username: 'marc_velo',
          displayName: 'Marc Gagnon',
          email: 'marc@example.ca',
          postalCode: 'H2H1M8',
          homeDistrictId: plateau._id,
          role: 'resident',
        },
        {
          username: 'camille_mtl',
          displayName: 'Camille Tremblay',
          email: 'camille@example.ca',
          postalCode: 'H2J1S4',
          homeDistrictId: plateau._id,
          role: 'district_manager',
          isVerified: true,
          isActivePost: true,
        },
        {
          username: 'admin_mtl',
          displayName: 'Admin MTL',
          email: 'admin@example.ca',
          postalCode: 'H2S2A9',
          homeDistrictId: plateau._id,
          role: 'admin',
        },
      ]);
      await DistrictModel.updateOne(
        { _id: plateau._id },
        { managerId: manager._id, isClaimed: true },
      );
    });

    beforeEach(async () => {
      await Promise.all([
        IssueModel.deleteMany({}),
        IssueCommentModel.deleteMany({}),
        IssueVoteModel.deleteMany({}),
      ]);
    });

    after(dropTestDb);

    it('creates an issue via JWT auth, enriches author/comments/officialResponse, toggles votes, updates status to resolved, and serves profile', async () => {
      const createdRes = await request(app)
        .post('/api/issues')
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({
          title: 'Blocked bike lane',
          description: 'Construction fencing blocks the lane.',
          category: 'traffic_safety',
          address: '1250 Rue Rachel Est',
          latitude: 45.5298,
          longitude: -73.5751,
          districtId: id(plateau),
          external311Ref: 'MTL-311-2026-88412',
        });
      assert.equal(createdRes.status, 201, JSON.stringify(createdRes.body));
      assert.equal(createdRes.body.author.username, 'marc_velo');
      assert.equal(createdRes.body.author.name, 'Marc Gagnon');
      assert.equal(createdRes.body.external311Ref, 'MTL-311-2026-88412');
      assert.equal(createdRes.body.commentsCount, 0);
      assert.equal(createdRes.body.officialResponse, null);

      const issueId: string = createdRes.body.id;

      // Resident cannot post an official response.
      const forbiddenOfficial = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({ body: 'Fake official', isOfficialResponse: true });
      assert.equal(forbiddenOfficial.status, 403);

      // Resident posts normal comment with photo; manager posts official response.
      const commentPhotoUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'demo'}/image/upload/v1700000000/issues/comment-1.jpg`;
      const residentComment = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({ body: 'Still blocked this morning.', images: [commentPhotoUrl] });
      assert.equal(residentComment.status, 201);
      assert.equal(residentComment.body.author.username, 'marc_velo');
      assert.deepEqual(residentComment.body.images, [commentPhotoUrl]);

      const officialComment = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .set('Authorization', tokenFor(manager, 'district_manager'))
        .send({ body: 'Inspection crew dispatched.', isOfficialResponse: true });
      assert.equal(officialComment.status, 201);
      assert.equal(officialComment.body.isOfficialResponse, true);

      // GET /api/issues/:id includes commentsCount and officialResponse.
      const fetched = await request(app).get(`/api/issues/${issueId}`);
      assert.equal(fetched.status, 200);
      assert.equal(fetched.body.commentsCount, 2);
      assert.equal(fetched.body.officialResponse.author, 'camille_mtl');
      assert.equal(fetched.body.officialResponse.comment, 'Inspection crew dispatched.');

      // Toggle upvote on, then off, then on again + confirm_resolved.
      const up1 = await request(app)
        .post(`/api/issues/${issueId}/votes`)
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({ voteType: 'upvote' });
      assert.deepEqual(up1.body, {
        issueId,
        voteType: 'upvote',
        active: true,
        upvoteCount: 1,
        resolutionConfirmations: 0,
      });

      const up2 = await request(app)
        .post(`/api/issues/${issueId}/votes`)
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({ voteType: 'upvote' });
      assert.equal(up2.body.active, false);
      assert.equal(up2.body.upvoteCount, 0);

      await request(app)
        .post(`/api/issues/${issueId}/votes`)
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({ voteType: 'upvote' });
      await request(app)
        .post(`/api/issues/${issueId}/votes`)
        .set('Authorization', tokenFor(resident, 'resident'))
        .send({ voteType: 'confirm_resolved' });

      const myVotes = await request(app)
        .get('/api/issues/votes/me')
        .set('Authorization', tokenFor(resident, 'resident'));
      assert.deepEqual(myVotes.body, {
        upvotedIssueIds: [issueId],
        confirmedIssueIds: [issueId],
      });

      // Manager moves status to `resolved` using JWT auth.
      const resolved = await request(app)
        .patch(`/api/issues/${issueId}/status`)
        .set('Authorization', tokenFor(manager, 'district_manager'))
        .send({ status: 'resolved' });
      assert.equal(resolved.status, 200);
      assert.equal(resolved.body.status, 'resolved');

      // Profile endpoints for resident, manager, and admin.
      const residentProfile = await request(app)
        .get('/api/profile/me')
        .set('Authorization', tokenFor(resident, 'resident'));
      assert.equal(residentProfile.status, 200);
      assert.equal(residentProfile.body.issues.length, 1);
      assert.equal(residentProfile.body.votes.length, 2);

      const managerProfile = await request(app)
        .get('/api/profile/me')
        .set('Authorization', tokenFor(manager, 'district_manager'));
      assert.equal(managerProfile.status, 200);
      assert.equal(managerProfile.body.person.isVerified, true);
      assert.equal(managerProfile.body.issues.length, 1);
      assert.equal(managerProfile.body.comments.length, 2);

      const adminProfile = await request(app)
        .get('/api/profile/me')
        .set('Authorization', tokenFor(admin, 'admin'));
      assert.equal(adminProfile.status, 200);
      assert.equal(adminProfile.body.districts.length, 1);
      assert.equal(adminProfile.body.issues.length, 1);
    });
  },
);
