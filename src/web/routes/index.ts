import { Router } from 'express';
import { Logger } from '../../shared/utils/logger'; // Corrected path
import healthRoutes from './health';
import configRoutes from './config';
import apiRoutes from './api';
import authRoutes from './auth';
// Import project, tools, chat, file, user routes
import projectRoutes from './project';
import toolsRoutes from './tools';
// import chatRoutes from './chat'; // Assuming chat routes exist
// import fileRoutes from './files'; // Assuming file routes exist
// import userRoutes from './user'; // Assuming user routes exist

import { errorHandler } from '../middleware/errorHandler';
import { requestLogger } from '../middleware/logging'; // Corrected path assuming requestLogger is in logging.ts
import { validateApiKey } from '../middleware/auth'; // Import validateApiKey

const router = Router();
const logger = Logger.getInstance();

// Apply middleware
router.use(requestLogger);

// Define routes
router.use('/health', healthRoutes);
router.use('/config', configRoutes);
router.use('/api', apiRoutes); // General API routes, might include sub-routes like /api/chat, /api/files etc.
router.use('/auth', authRoutes);
router.use('/project', projectRoutes);

// Apply validateApiKey middleware specifically to /tools routes if they are grouped under their own router
// If /api/tools is handled by apiRoutes, then this middleware should be applied within apiRoutes or toolsRoutes.
// For now, let's assume toolsRoutes handles /tools directly and needs API key validation.
router.use('/tools', validateApiKey, toolsRoutes);

// router.use('/chat', chatRoutes);
// router.use('/files', fileRoutes);
// router.use('/user', userRoutes);

// Error handling (must be last)
router.use(errorHandler);

// Log route initialization
logger.info('Routes initialized', {
  routes: ['/health', '/config', '/api', '/auth', '/project', '/tools']
});

export default router;
