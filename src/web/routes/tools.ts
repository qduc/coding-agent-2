import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ToolError, ToolErrorCode } from '../../shared/tools/types';
import { ApiResponse, ApiError } from '../types/api';
import { validateRequest } from '../middleware/validation';
import { getTools, getToolByName, getToolsByCategory } from '../../shared/tools/registry';
import { ToolExecutionContext } from '../../shared/tools/types';
import { WebToolExecutionContext } from '../implementations/WebToolExecutionContext';
import { Logger } from '../../shared/utils/logger';

const router = Router();
const logger = Logger.getInstance();

// Rate limiting for tool execution
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 tool executions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many tool executions, please try again later'
});

/**
 * GET /api/tools
 * List all available tools with descriptions and schemas
 */
router.get('/', async (req, res) => {
  try {
    const tools = getTools();
    const response: ApiResponse = {
      success: true,
      data: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        schema: tool.schema
      })),
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to list tools', { error });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TOOLS_LIST_ERROR',
        message: 'Failed to retrieve tools list',
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/tools/:toolName
 * Get specific tool information
 */
router.get('/:toolName', validateRequest, async (req, res) => {
  try {
    const tool = getToolByName(req.params.toolName);
    if (!tool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${req.params.toolName}' not found`,
          timestamp: new Date()
        },
        timestamp: new Date()
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        schema: tool.schema,
        examples: tool.examples || []
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get tool details', { error, toolName: req.params.toolName });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TOOL_DETAILS_ERROR',
        message: 'Failed to retrieve tool details',
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/tools/categories
 * Get tools grouped by category
 */
router.get('/categories', async (req, res) => {
  try {
    const categorizedTools = getToolsByCategory();
    const response: ApiResponse = {
      success: true,
      data: categorizedTools,
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get tools by category', { error });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TOOLS_CATEGORY_ERROR',
        message: 'Failed to retrieve tools by category',
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/tools/execute
 * Execute a tool with validated parameters
 */
router.post('/execute', executionLimiter, validateRequest, async (req, res) => {
  const { toolName, parameters, context } = req.body;

  try {
    const tool = getToolByName(toolName);
    if (!tool) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${toolName}' not found`,
          timestamp: new Date()
        },
        timestamp: new Date()
      };
      return res.status(404).json(response);
    }

    // Create execution context
    const executionContext = new WebToolExecutionContext({
      workingDirectory: context?.workingDirectory || process.cwd(),
      environment: context?.environment || {},
      permissions: context?.permissions || {
        fileSystem: true,
        network: true,
        shell: false
      }
    });

    // Execute the tool
    const result = await tool.execute(parameters, executionContext);

    const response: ApiResponse = {
      success: true,
      data: {
        tool: toolName,
        result,
        executionContext: {
          workingDirectory: executionContext.workingDirectory,
          environment: Object.keys(executionContext.environment)
        }
      },
      timestamp: new Date()
    };
    res.json(response);

    logger.info('Tool executed successfully', {
      tool: toolName,
      parameters: Object.keys(parameters),
      executionContext: response.data.executionContext
    });
  } catch (error) {
    let apiError: ApiError;
    let statusCode = 500;

    if (error instanceof ToolError) {
      statusCode = mapToolErrorToStatusCode(error.code);
      apiError = {
        code: error.code,
        message: error.message,
        details: error.suggestions,
        timestamp: new Date()
      };
    } else {
      apiError = {
        code: 'TOOL_EXECUTION_ERROR',
        message: 'An unexpected error occurred during tool execution',
        timestamp: new Date(),
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      };
    }

    logger.error('Tool execution failed', {
      tool: toolName,
      error: apiError,
      parameters: req.body.parameters
    });

    const response: ApiResponse = {
      success: false,
      error: apiError,
      timestamp: new Date()
    };
    res.status(statusCode).json(response);
  }
});

function mapToolErrorToStatusCode(code: ToolErrorCode): number {
  switch (code) {
    case 'FILE_NOT_FOUND':
    case 'INVALID_PATH':
      return 404;
    case 'PERMISSION_DENIED':
      return 403;
    case 'INVALID_PARAMS':
    case 'VALIDATION_ERROR':
      return 400;
    case 'FILE_TOO_LARGE':
      return 413;
    case 'OPERATION_TIMEOUT':
      return 408;
    default:
      return 500;
  }
}

export default router;
