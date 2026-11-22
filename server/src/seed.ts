import type { Types } from 'mongoose';

import { connectMongo, disconnectMongo } from './lib/mongo.js';
import { hashPassword } from './lib/password.js';
import {
  DistrictModel,
  IssueCommentModel,
  IssueModel,
  IssueVoteModel,
  PersonModel,
} from './models/index.js';

/**
 * Idempotent seed script for local/demo MongoDB instances.
 * Inserts the Montreal districts, sample accounts, issues, comments, and votes if not present.
 */
async function seed() {
  await connectMongo();

  const defaultPasswordHash = await hashPassword('password123');

  const districtSpecs = [
    {
      nameFr: 'Le Plateau-Mont-Royal',
      nameEn: 'Le Plateau-Mont-Royal',
      openNorthSlug: 'le-plateau-mont-royal',
      districtType: 'borough' as const,
      postalCode: 'H2J 1S4',
    },
    {
      nameFr: 'Ville-Marie',
      nameEn: 'Ville-Marie',
      openNorthSlug: 'ville-marie',
      districtType: 'borough' as const,
      postalCode: 'H2L 2C9',
    },
    {
      nameFr: 'Rosemont–La Petite-Patrie',
      nameEn: 'Rosemont–La Petite-Patrie',
      openNorthSlug: 'rosemont-la-petite-patrie',
      districtType: 'borough' as const,
      postalCode: 'H1Y 2A1',
    },
    {
      nameFr: 'Westmount',
      nameEn: 'Westmount',
      openNorthSlug: 'westmount',
      districtType: 'municipality' as const,
      postalCode: 'H3Z 1A1',
    },
  ];

  const districtBySlug = new Map<string, (typeof DistrictModel)['prototype']>();
  for (const spec of districtSpecs) {
    let doc = await DistrictModel.findOne({ openNorthSlug: spec.openNorthSlug });
    if (!doc) {
      doc = await DistrictModel.create({ ...spec, managerId: null, isClaimed: false });
    } else if (!doc.postalCode && spec.postalCode) {
      doc.postalCode = spec.postalCode;
      await doc.save();
    }
    districtBySlug.set(spec.openNorthSlug, doc);
  }

  const personSpecs = [
    {
      username: 'camille_mtl',
      displayName: 'Camille Tremblay',
      email: 'camille.tremblay@example.ca',
      postalCode: 'H2J1S4',
      homeDistrictSlug: 'le-plateau-mont-royal',
      managesSlug: 'le-plateau-mont-royal',
      role: 'district_manager' as const,
      isVerified: true,
      isActivePost: true,
      preferredLanguage: 'fr' as const,
    },
    {
      username: 'marc_velo',
      displayName: 'Marc Gagnon',
      email: 'marc.gagnon@example.ca',
      postalCode: 'H2H1M8',
      homeDistrictSlug: 'le-plateau-mont-royal',
      role: 'resident' as const,
      isVerified: false,
      isActivePost: false,
      preferredLanguage: 'fr' as const,
    },
    {
      username: 'sarah_qc',
      displayName: 'Sarah Chen',
      email: 'sarah.chen@example.ca',
      postalCode: 'H2X1Y4',
      homeDistrictSlug: 'ville-marie',
      role: 'resident' as const,
      isVerified: false,
      isActivePost: false,
      preferredLanguage: 'en' as const,
    },
    {
      username: 'ops_villemarie',
      displayName: 'Coordination Ville-Marie',
      email: 'coord.vm@example.ca',
      postalCode: 'H2Y1C6',
      homeDistrictSlug: 'ville-marie',
      managesSlug: 'ville-marie',
      role: 'district_manager' as const,
      isVerified: true,
      isActivePost: true,
      preferredLanguage: 'fr' as const,
    },
    {
      username: 'admin_mtl',
      displayName: 'Admin MTL',
      email: 'admin@montone.example.ca',
      postalCode: 'H2S2A9',
      homeDistrictSlug: 'rosemont-la-petite-patrie',
      role: 'admin' as const,
      isVerified: false,
      isActivePost: false,
      preferredLanguage: 'en' as const,
    },
  ];

  const personByUsername = new Map<string, (typeof PersonModel)['prototype']>();
  for (const spec of personSpecs) {
    let doc = await PersonModel.findOne({ email: spec.email });
    const homeDistrict = districtBySlug.get(spec.homeDistrictSlug);
    if (!doc) {
      doc = await PersonModel.create({
        username: spec.username,
        displayName: spec.displayName,
        email: spec.email,
        passwordHash: defaultPasswordHash,
        postalCode: spec.postalCode,
        homeDistrictId: homeDistrict?._id ?? null,
        role: spec.role,
        isVerified: spec.isVerified,
        isActivePost: spec.isActivePost,
        preferredLanguage: spec.preferredLanguage,
      });
    } else {
      let dirty = false;
      if (!doc.displayName) {
        doc.displayName = spec.displayName;
        dirty = true;
      }
      if (!doc.homeDistrictId && homeDistrict?._id) {
        doc.homeDistrictId = homeDistrict._id;
        dirty = true;
      }
      if (doc.role !== spec.role) {
        doc.role = spec.role;
        dirty = true;
      }
      if (spec.isVerified && !doc.isVerified) {
        doc.isVerified = true;
        dirty = true;
      }
      if (spec.isActivePost && !doc.isActivePost) {
        doc.isActivePost = true;
        dirty = true;
      }
      if (dirty) await doc.save();
    }
    personByUsername.set(spec.username, doc);

    if (spec.managesSlug) {
      const managed = districtBySlug.get(spec.managesSlug);
      if (managed && !managed.managerId) {
        managed.managerId = doc._id;
        managed.isClaimed = true;
        await managed.save();
      }
    }
  }

  const plateau = districtBySlug.get('le-plateau-mont-royal')!;
  const villeMarie = districtBySlug.get('ville-marie')!;
  const rosemont = districtBySlug.get('rosemont-la-petite-patrie')!;
  const westmount = districtBySlug.get('westmount')!;

  const marc = personByUsername.get('marc_velo')!;
  const camille = personByUsername.get('camille_mtl')!;
  const sarah = personByUsername.get('sarah_qc')!;
  const opsVm = personByUsername.get('ops_villemarie')!;
  const admin = personByUsername.get('admin_mtl')!;

  const ensureIssue = async (spec: {
    title: string;
    description: string;
    category: 'traffic_safety' | 'streetlights_utilities' | 'roads_potholes';
    status: 'not_started' | 'in_progress' | 'resolved';
    images: string[];
    address: string;
    latitude: number;
    longitude: number;
    districtId: Types.ObjectId;
    createdById: Types.ObjectId;
    updatedById: Types.ObjectId | null;
    upvoteCount: number;
    resolutionConfirmations: number;
    external311Ref: string | null;
  }) => {
    const existing = await IssueModel.findOne({ title: spec.title });
    if (existing) return existing;
    return IssueModel.create(spec);
  };

  const bikeLane = await ensureIssue({
    title: 'Blocked bike lane on Rue Rachel Est',
    description:
      'Construction barriers are blocking the protected bike lane near Parc La Fontaine with no marked detour.',
    category: 'traffic_safety',
    status: 'in_progress',
    images: [
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    ],
    address: '1250 Rue Rachel Est, Montréal, QC H2J 2J9',
    latitude: 45.529841,
    longitude: -73.575124,
    districtId: plateau._id,
    createdById: marc._id,
    updatedById: camille._id,
    upvoteCount: 2,
    resolutionConfirmations: 1,
    external311Ref: 'MTL-311-2026-88412',
  });

  const elevator = await ensureIssue({
    title: 'Out-of-service station elevator near Berri-UQAM',
    description:
      'Pedestrian and transit access elevator on Rue Sainte-Catherine Est is out of service.',
    category: 'streetlights_utilities',
    status: 'in_progress',
    images: [],
    address: '505 Rue Sainte-Catherine Est, Montréal, QC H2L 2C9',
    latitude: 45.515218,
    longitude: -73.560412,
    districtId: villeMarie._id,
    createdById: sarah._id,
    updatedById: opsVm._id,
    upvoteCount: 1,
    resolutionConfirmations: 0,
    external311Ref: 'MTL-311-2026-89004',
  });

  await ensureIssue({
    title: 'Deep pothole near Beaubien and Saint-Denis',
    description: 'Large pothole forming in the right lane after freeze-thaw cycle.',
    category: 'roads_potholes',
    status: 'not_started',
    images: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1200&q=80',
    ],
    address: '7045 Rue Saint-Denis, Montréal, QC H2S 2S3',
    latitude: 45.537812,
    longitude: -73.606541,
    districtId: rosemont._id,
    createdById: admin._id,
    updatedById: null,
    upvoteCount: 0,
    resolutionConfirmations: 0,
    external311Ref: null,
  });

  await ensureIssue({
    title: 'Sunken manhole cover on Rue Sherbrooke Ouest',
    description:
      'A manhole cover has sunk several centimetres below the road surface near Avenue Clarke.',
    category: 'roads_potholes',
    status: 'not_started',
    images: [],
    address: '4300 Rue Sherbrooke Ouest, Westmount, QC H3Z 1A1',
    latitude: 45.48572,
    longitude: -73.59456,
    districtId: westmount._id,
    createdById: sarah._id,
    updatedById: null,
    upvoteCount: 0,
    resolutionConfirmations: 0,
    external311Ref: null,
  });

  if ((await IssueCommentModel.countDocuments({ issueId: bikeLane._id })) === 0) {
    await IssueCommentModel.create([
      {
        issueId: bikeLane._id,
        userId: marc._id,
        body: 'The bike lane on Rachel Street East near Parc La Fontaine is completely blocked by construction barriers with no detour signs.',
        isOfficialResponse: false,
      },
      {
        issueId: bikeLane._id,
        userId: camille._id,
        body: 'Thank you for reporting this. Le Plateau-Mont-Royal inspection team has been notified and will verify contractor permit compliance today.',
        isOfficialResponse: true,
      },
      {
        issueId: bikeLane._id,
        userId: marc._id,
        body: 'Confirmed—they moved the fencing back onto the sidewalk perimeter this afternoon so cyclists can pass safely.',
        isOfficialResponse: false,
      },
    ]);
  }

  if ((await IssueCommentModel.countDocuments({ issueId: elevator._id })) === 0) {
    await IssueCommentModel.create([
      {
        issueId: elevator._id,
        userId: sarah._id,
        body: 'The elevator at Berri-UQAM station (Orange line platform) is out of service again. Difficult access with a stroller.',
        isOfficialResponse: false,
      },
      {
        issueId: elevator._id,
        userId: opsVm._id,
        body: 'Maintenance crews are on-site in Ville-Marie. Estimated restoration time is 18:00.',
        isOfficialResponse: true,
      },
    ]);
  }

  const seedVotes = [
    { issueId: bikeLane._id, userId: marc._id, voteType: 'upvote' as const },
    { issueId: bikeLane._id, userId: sarah._id, voteType: 'upvote' as const },
    { issueId: bikeLane._id, userId: marc._id, voteType: 'confirm_resolved' as const },
    { issueId: elevator._id, userId: sarah._id, voteType: 'upvote' as const },
  ];
  for (const vote of seedVotes) {
    await IssueVoteModel.updateOne(vote, { $setOnInsert: vote }, { upsert: true });
  }

  const [districts, persons, issues, comments, votes] = await Promise.all([
    DistrictModel.countDocuments(),
    PersonModel.countDocuments(),
    IssueModel.countDocuments(),
    IssueCommentModel.countDocuments(),
    IssueVoteModel.countDocuments(),
  ]);
  console.log('[seed] Done', { districts, persons, issues, comments, votes });
  await disconnectMongo();
}

void seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
