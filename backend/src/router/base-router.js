import express from 'express';
import api_v1_router from './api-v1/api-v1.js';
import { overlayDispatcher } from '../overlays/overlays-registry.js';
import { clientV1Router } from './api-v1/overlay/client-v1.js';

const baseRouter = express.Router();

baseRouter.get('/', (req, res) => {
  res.send('Base router is working!');
});

baseRouter.use('/api/v1', api_v1_router);
baseRouter.use('/overlay-service', overlayDispatcher);
baseRouter.use('/clients', clientV1Router);

export default baseRouter;
