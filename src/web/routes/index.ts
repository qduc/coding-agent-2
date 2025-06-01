import { Router } from 'express';
import { Logger } from '../shared/utils/logger';
import healthRoutes from './health';
import configRoutes from './config';
import apiRoutes from './api';
import authRoutes from './auth';
import { errorHandler } from '../middleware/errorHandler';
import { requestLogger } from '../middleware/requestLogger';

const router = Router();
const logger = Logger.getInstance();

// Apply middleware
router.use(requestLogger);
router.use('/health', healthRoutes);
router.use('/config', configRoutes);
router.use('/api', apiRoutes);
router.use('/auth', authRoutes);

// Error handling (must be last)
router.use(errorHandler);

// Log route initialization
logger.info('Routes initialized', {
  routes: ['/health', '/config', '/api', '/auth']
});

export default router;
