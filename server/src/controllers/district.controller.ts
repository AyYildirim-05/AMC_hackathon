import { Router } from 'express';

import { parseParams, validateBody } from '../middleware/validate.js';
import {
  allDistricts,
  createDistrict,
  createDistrictInput,
  deleteDistrict,
  deleteDistrictInput,
  districtById,
  districtByName,
  districtIdParams,
  districtNameParams,
  updateDistrict,
  updateDistrictInput,
} from '../services/district.service.js';

export const districtRouter = Router();

districtRouter.get('/', async (_req, res) => {
  res.json(await allDistricts());
});

districtRouter.post('/', validateBody(createDistrictInput), async (req, res) => {
  res.status(201).json(await createDistrict(req.body));
});

districtRouter.get('/name/:name', async (req, res) => {
  const { name } = parseParams(districtNameParams, req.params);
  res.json(await districtByName(name));
});

districtRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(districtIdParams, req.params);
  res.json(await districtById(id));
});

districtRouter.patch('/:id', validateBody(updateDistrictInput), async (req, res) => {
  const { id } = parseParams(districtIdParams, req.params);
  res.json(await updateDistrict(id, req.body));
});

districtRouter.delete('/:id', validateBody(deleteDistrictInput), async (req, res) => {
  const { id } = parseParams(districtIdParams, req.params);
  await deleteDistrict(id, req.body);
  res.status(204).end();
});
