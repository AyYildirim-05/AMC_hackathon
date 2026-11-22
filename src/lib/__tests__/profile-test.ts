import { TEST_PROFILE_DATA } from '../../../test/fixtures';

import type { Issue } from '@/models/Issue';
import {
  buildAdminProfile,
  buildDistrictProfile,
  buildResidentProfile,
  computeStats,
  type IssueComment,
} from '@/lib/profile';

describe('buildDistrictProfile', () => {
  const profile = buildDistrictProfile('camille_mtl', TEST_PROFILE_DATA);

  it("finds Camille's district and derives her display name", () => {
    expect(profile?.manager.username).toBe('camille_mtl');
    expect(profile?.manager.display_name).toBe('Camille Tremblay');
    expect(profile?.district.name_fr).toBe('Le Plateau-Mont-Royal');
  });

  it('lists her own district first, then the other claimed districts with their manager', () => {
    expect(
      profile?.territories.map((t) => [t.district.name_fr, t.managerUsername, t.isOwn]),
    ).toEqual([
      ['Le Plateau-Mont-Royal', 'camille_mtl', true],
      ['Ville-Marie', 'ops_villemarie', false],
    ]);
  });

  it("keeps only her district's issues, with reporter and latest official reply", () => {
    const [issue] = profile?.issues ?? [];
    expect(profile?.issues.map((i) => i.title)).toEqual(['Blocked bike lane on Rue Rachel Est']);
    expect(profile?.reporterUsername[issue.id]).toBe('marc_velo');
    expect(profile?.latestOfficialReply[issue.id]).toEqual({
      body: expect.stringContaining('inspection team has been notified'),
      createdAt: '2026-11-18T11:42:10.000Z',
    });
  });

  it('computes the operational stats', () => {
    // Reported 08:00, first official reply 11:42:10 → 3.70 h.
    expect(profile?.stats).toEqual({
      activeIssues: 1,
      responseRate311: 100,
      avgFirstResponseHours: expect.closeTo(3.7, 2),
      confirmedResolutions: 1,
    });
  });

  it('returns null for someone who manages no district', () => {
    expect(buildDistrictProfile('marc_velo', TEST_PROFILE_DATA)).toBeNull();
    expect(buildDistrictProfile('nobody', TEST_PROFILE_DATA)).toBeNull();
  });
});

describe('computeStats', () => {
  const issue = (over: Partial<Issue>): Issue => ({
    ...TEST_PROFILE_DATA.issues[0],
    ...over,
  });
  const reply = (issueId: string, createdAt: string, official = true): IssueComment => ({
    id: `${issueId}-${createdAt}`,
    issue_id: issueId,
    user_id: 'u',
    body: 'b',
    is_official_response: official,
    created_at: createdAt,
  });

  it('returns null rates instead of dividing by zero when there is nothing to measure', () => {
    expect(computeStats([], [])).toEqual({
      activeIssues: 0,
      responseRate311: null,
      avgFirstResponseHours: null,
      confirmedResolutions: 0,
    });
  });

  it('uses the first official reply per issue and ignores resident comments', () => {
    const issues = [
      issue({ id: 'a', created_at: '2026-01-01T00:00:00.000Z', external_311_ref: null }),
      issue({ id: 'b', created_at: '2026-01-01T00:00:00.000Z', status: 'resolved' }),
    ];
    const comments = [
      reply('a', '2026-01-01T01:00:00.000Z', false), // resident: ignored
      reply('a', '2026-01-01T04:00:00.000Z'), // later official: ignored
      reply('a', '2026-01-01T02:00:00.000Z'), // first official: 2 h
      reply('b', '2026-01-01T06:00:00.000Z'), // 6 h
    ];
    expect(computeStats(issues, comments)).toMatchObject({
      activeIssues: 1,
      responseRate311: 50,
      avgFirstResponseHours: 4,
    });
  });
});

describe('buildResidentProfile', () => {
  it("counts marc_velo's reports, votes and comments", () => {
    const marc = buildResidentProfile('marc_velo', TEST_PROFILE_DATA);
    expect(marc?.person.display_name).toBe('Marc Gagnon');
    expect(marc?.homeDistrict?.name_fr).toBe('Le Plateau-Mont-Royal');
    expect(marc?.reports.map((i) => i.title)).toEqual(['Blocked bike lane on Rue Rachel Est']);
    // issue_votes: one upvote and one confirm_resolved; issue_comments: two comments.
    expect(marc?.activity).toEqual({
      reports: 1,
      upvotesGiven: 1,
      confirmationsGiven: 1,
      comments: 2,
    });
  });

  it("counts the team account Ahmet's report, upvote and comment", () => {
    const ahmet = buildResidentProfile('Ahmet', TEST_PROFILE_DATA);
    expect(ahmet?.person.display_name).toBe('Ahmet');
    expect(ahmet?.homeDistrict?.name_fr).toBe('Rosemont–La Petite-Patrie');
    expect(ahmet?.reports.map((i) => i.title)).toEqual(['Streetlight out on Rue Masson']);
    expect(ahmet?.activity).toEqual({
      reports: 1,
      upvotesGiven: 1,
      confirmationsGiven: 0,
      comments: 1,
    });
  });

  it('returns null for an unknown username', () => {
    expect(buildResidentProfile('someone_new', TEST_PROFILE_DATA)).toBeNull();
  });
});

describe('buildAdminProfile', () => {
  it('lists every district with its manager and open issues, plus city totals', () => {
    const admin = buildAdminProfile('admin_mtl', TEST_PROFILE_DATA);
    expect(
      admin?.districts.map((d) => [d.district.name_fr, d.managerUsername, d.openIssues]),
    ).toEqual([
      ['Le Plateau-Mont-Royal', 'camille_mtl', 1],
      ['Ville-Marie', 'ops_villemarie', 1],
      ['Rosemont–La Petite-Patrie', null, 2],
      ['Westmount', null, 1],
    ]);
    expect(admin?.totals).toEqual({ districts: 4, unclaimedDistricts: 2, openIssues: 5 });
    // Two of five issues have a 311 reference.
    expect(admin?.stats.responseRate311).toBe(40);
  });
});
