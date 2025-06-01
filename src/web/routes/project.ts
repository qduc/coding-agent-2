import { Router, Request, Response } from 'express';
import { ProjectDiscovery } from '../../shared/utils/projectDiscovery';
import { CLIToolExecutionContext } from '../../cli/implementations/CLIToolExecutionContext';
import { ApiResponse, ProjectContext, ProjectDiscoveryResult, ApiError, ErrorResponse } from '../types/api'; // Added ApiError, ErrorResponse
import { ToolError } from '../../shared/tools/types';
import { rateLimit } from 'express-rate-limit'; // Standard import
import path from 'path';
import fs from 'fs/promises';

const router = Router();
const discovery = new ProjectDiscovery();
const context = new CLIToolExecutionContext();

// Rate limiting for analysis endpoints
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Project Discovery Endpoints
 */
router.get('/discovery', async (req, res) => {
  try {
    const result = await discovery.discover();
    const response: ApiResponse<ProjectDiscoveryResult> = {
      success: true,
      data: result,
      timestamp: new Date(),
    };
    res.json(response);
    return;
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

router.post('/analyze', analysisLimiter, async (req, res) => {
  try {
    const { forceRefresh = false } = req.body;
    const result = await discovery.analyze(forceRefresh);
    const response: ApiResponse<ProjectDiscoveryResult> = {
      success: true,
      data: result,
      timestamp: new Date(),
    };
    res.json(response);
    return;
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

/**
 * File System Endpoints
 */
router.get('/files', async (req, res) => {
  try {
    const { path: relativePath = '.' } = req.query;
    const absolutePath = await validatePath(relativePath as string);
    const stats = await fs.stat(absolutePath);
    
    if (stats.isDirectory()) {
      const files = await fs.readdir(absolutePath);
      const response: ApiResponse<string[]> = {
        success: true,
        data: files,
        timestamp: new Date(),
      };
      res.json(response);
    } else {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const response: ApiResponse<{ content: string }> = {
        success: true,
        data: { content },
        timestamp: new Date(),
      };
      res.json(response);
      return;
    }
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

router.get('/files/tree', async (req, res) => {
  try {
    const { maxDepth = 3 } = req.query;
    const tree = await discovery.getFileTree(Number(maxDepth));
    const response: ApiResponse<any> = { // Assuming tree structure is complex, using 'any' for data type
      success: true,
      data: tree,
      timestamp: new Date(),
    };
    res.json(response);
    return;
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

router.post('/files/search', async (req, res) => {
  try {
    const { pattern } = req.body;
    if (!pattern) {
      throw new ToolError('Search pattern is required', 'INVALID_PARAMS');
    }
    const results = await discovery.searchFiles(pattern);
    const response: ApiResponse<string[]> = {
      success: true,
      data: results,
      timestamp: new Date(),
    };
    res.json(response);
    return;
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

/**
 * Project Context Endpoints
 */
router.get('/context', async (req, res) => {
  try {
    const discoveryResult = await discovery.discover(); // This is ProjectDiscoveryResult
    const projectContextData: ProjectContext = {
      discovery: discoveryResult,
      workingDirectory: context.workingDirectory,
      environment: context.environment as Record<string, unknown>, // Ensure type match
      // fileTree and metadata are optional in ProjectContext type now
    };
    const response: ApiResponse<ProjectContext> = {
      success: true,
      data: projectContextData, // Corrected from contextData
      timestamp: new Date(),
    };
    res.json(response);
    return;
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

router.get('/technologies', async (req, res) => {
  try {
    const techStack = await discovery.detectTechnologies();
    const response: ApiResponse<string[]> = {
      success: true,
      data: techStack, // techStack is already string[]
      timestamp: new Date(),
    };
    res.json(response);
    return;
  } catch (error) {
    handleProjectError(res, error);
    return;
  }
});

/**
 * Helper Functions
 */
async function validatePath(relativePath: string): Promise<string> {
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(context.workingDirectory, relativePath);

  // Prevent directory traversal
  const normalizedPath = path.normalize(absolutePath);
  if (!normalizedPath.startsWith(context.workingDirectory)) {
    throw new ToolError('Access denied: path traversal attempt', 'PERMISSION_DENIED');
  }

  try {
    await fs.access(normalizedPath);
    return normalizedPath;
  } catch (error) {
    throw new ToolError(`Path not found: ${relativePath}`, 'FILE_NOT_FOUND');
  }
}

function handleProjectError(res: Response, error: unknown) { // Changed res type to Response
  let apiError: ApiError;
  let statusCode = 500;

  if (error instanceof ToolError) {
    apiError = {
      code: error.code,
      message: error.message,
      // suggestions: error.suggestions, // Removed suggestions as it might not be in base ApiError
      details: error.stack, // Optionally include stack or more details for ToolError
      timestamp: new Date(),
    };
    statusCode = 400; 
  } else {
    const err = error instanceof Error ? error : new Error(String(error));
    apiError = {
      code: 'PROJECT_OPERATION_FAILED',
      message: err.message,
      details: err.stack, // Include stack for unexpected errors
      timestamp: new Date(),
    };
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: apiError,
    data: null, // Ensure ErrorResponse has a data field, typically null
    timestamp: new Date(),
  };
  res.status(statusCode).json(errorResponse);
}

export default router;
