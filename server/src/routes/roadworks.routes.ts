import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import {
  filterRoadworks,
  loadRoadworks,
  ROADWORK_TYPES,
  type RoadworkType,
  ROADWORKS_SOURCE,
} from '../lib/montreal-roadworks.js';

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );

const roadworksQuery = z.object({
  boroughs: csv,
  types: csv.pipe(z.array(z.enum(ROADWORK_TYPES))),
  cityOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  when: z.enum(['active', 'upcoming']).default('active'),
});

export const roadworksRouter = Router();

/**
 * GET /api/roadworks?boroughs=Ville-Marie,Le Plateau-Mont-Royal&types=roads,water&cityOnly=true&when=active
 *
 * City of Montréal roadworks for the map. `typeCounts` ignores the `types` filter, so the app can
 * show how many works each type chip would add.
 */
roadworksRouter.get('/', async (req, res) => {
  const parsed = roadworksQuery.safeParse(req.query);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid roadworks query', z.flattenError(parsed.error));
  }
  const { boroughs, types, cityOnly, when } = parsed.data;
  const { works, fetchedAt } = await loadRoadworks();

  const beforeType = filterRoadworks(works, { boroughs, cityOnly, when });
  const typeCounts = Object.fromEntries(ROADWORK_TYPES.map((type) => [type, 0])) as Record<
    RoadworkType,
    number
  >;
  for (const work of beforeType) typeCounts[work.type] += 1;
  const selected = types.length > 0 ? beforeType.filter((w) => types.includes(w.type)) : beforeType;

  res.json({
    source: ROADWORKS_SOURCE,
    fetchedAt,
    total: selected.length,
    typeCounts,
    works: selected,
  });
});
