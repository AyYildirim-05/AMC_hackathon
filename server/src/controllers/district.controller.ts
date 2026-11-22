import { type RequestHandler, Router } from 'express';

import { optionalAuth } from '../middleware/auth.js';
import { parseParams, validateBody } from '../middleware/validate.js';
import {
  allDistricts,
  allMontrealDistricts,
  createDistrict,
  createDistrictInput,
  deleteDistrict,
  deleteDistrictInput,
  districtById,
  districtByName,
  districtIdParams,
  districtNameParams,
  locateDistrictByCoordinates,
  locateDistrictQuery,
  updateDistrict,
  updateDistrictInput,
} from '../services/district.service.js';

const withAuthActor: RequestHandler = (req, _res, next) => {
  if (req.auth?.userId) {
    req.body = {
      ...(req.body && typeof req.body === 'object' ? req.body : {}),
      actorId: req.auth.userId,
    };
  }
  next();
};

export const districtRouter = Router();

districtRouter.get('/', async (_req, res) => {
  res.json(await allDistricts());
});

districtRouter.post(
  '/',
  optionalAuth,
  withAuthActor,
  validateBody(createDistrictInput),
  async (req, res) => {
    res.status(201).json(await createDistrict(req.body));
  },
);

/** Every district, including all 19 City of Montréal boroughs (added from OpenNorth if missing). */
districtRouter.get('/montreal', async (_req, res) => {
  res.json(await allMontrealDistricts());
});

districtRouter.get('/locate', async (req, res) => {
  const { lat, lng } = parseParams(locateDistrictQuery, req.query);
  res.json(await locateDistrictByCoordinates(lat, lng));
});

districtRouter.get('/name/:name', async (req, res) => {
  const { name } = parseParams(districtNameParams, req.params);
  res.json(await districtByName(name));
});

districtRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(districtIdParams, req.params);
  res.json(await districtById(id));
});

districtRouter.patch(
  '/:id',
  optionalAuth,
  withAuthActor,
  validateBody(updateDistrictInput),
  async (req, res) => {
    const { id } = parseParams(districtIdParams, req.params);
    res.json(await updateDistrict(id, req.body));
  },
);

districtRouter.delete(
  '/:id',
  optionalAuth,
  withAuthActor,
  validateBody(deleteDistrictInput),
  async (req, res) => {
    const { id } = parseParams(districtIdParams, req.params);
    await deleteDistrict(id, req.body);
    res.status(204).end();
  },
);
