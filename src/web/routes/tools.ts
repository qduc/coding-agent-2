import { Router, Request, Response } from 'express'; // Added Request, Response
import { rateLimit } from 'express-rate-limit'; // Standard import
import { ToolError } from '../../shared/tools/types'; // Removed ToolErrorCode (unused here)
import { ApiResponse, ApiError, ErrorResponse } from '../types/api'; // Added ErrorResponse
// import { validateRequest } from '../middleware/validation'; // validateRequest not used in this file currently
import { tools } from '../../shared/tools';
// import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext'; // IToolExecutionContext not directly used here
import { WebToolExecutionContext } from '../implementations/WebToolExecutionContext';
import { Logger } from '../../shared/utils/logger';

const router = Router();
const logger = Logger.getInstance();

// Simple registry functions
const getTools = () => {
  return Object.entries(tools).map(([name, ToolClass]) => {
    const instance = new ToolClass();
    return {
      name: instance.name,
      description: instance.description,
      schema: instance.schema
    };
  });
};

const getToolByName = (name: string) => {
  const ToolClass = tools[name];
  if (!ToolClass) return null;
  const instance = new ToolClass();
  return {
    name: instance.name,
    description: instance.description,
    schema: instance.schema
  };
};

const getToolsByCategory = () => {
  const toolList = getTools();
  return {
    'file-system': toolList.filter(t => ['ls', 'read', 'write', 'glob'].includes(t.name)),
    'search': toolList.filter(t => ['ripgrep'].includes(t.name)),
    'execution': toolList.filter(t => ['bash'].includes(t.name))
  };
};

// Rate limiting for tool execution
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 tool executions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many tool executions, please try again later', // This message is for express-rate-limit v6. For v7+, use handler.
  // handler: (req, res, next, options) => res.status(options.statusCode).json({ message: options.message }) // For v7+
});

/**
 * GET /api/tools
 * List all available tools with descriptions and schemas
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const toolList = getTools();
    const responseData = toolList.map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema
    }));
    const response: ApiResponse<typeof responseData> = {
      success: true,
      data: responseData,
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to list tools', { error: { name: (error as Error).name, message: (error as Error).message, stack: (error as Error).stack }});
    const apiError: ApiError = {
      code: 'TOOL_LIST_ERROR',
      message: 'Failed to retrieve tools list',
      details: String(error),
      timestamp: new Date()
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

/**
 * GET /api/tools/:toolName
 * Get detailed information about a specific tool
 */
router.get('/:toolName', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const tool = getToolByName(toolName);

    if (!tool) {
      const apiError: ApiError = {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${toolName}' not found`,
        timestamp: new Date()
      };
      return res.status(404).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    }
    
    const responseData = {
      name: tool.name,
      description: tool.description,
      schema: tool.schema
    };
    const response: ApiResponse<typeof responseData> = {
      success: true,
      data: responseData,
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get tool details', { error: { name: (error as Error).name, message: (error as Error).message, stack: (error as Error).stack }});
    const apiError: ApiError = {
      code: 'TOOL_DETAILS_ERROR',
      message: 'Failed to retrieve tool details',
      details: String(error),
      timestamp: new Date()
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

/**
 * GET /api/tools/category/:category
 * Get tools by category
 */
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const categorizedTools = getToolsByCategory();

    if (!(category in categorizedTools)) {
      const apiError: ApiError = {
        code: 'CATEGORY_NOT_FOUND',
        message: `Category '${category}' not found`,
        timestamp: new Date()
      };
      return res.status(404).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    }

    const responseData = categorizedTools[category as keyof typeof categorizedTools];
    const response: ApiResponse<typeof responseData> = {
      success: true,
      data: responseData,
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get tools by category', { error: { name: (error as Error).name, message: (error as Error).message, stack: (error as Error).stack }});
    const apiError: ApiError = {
      code: 'TOOL_CATEGORY_ERROR',
      message: 'Failed to retrieve tools by category',
      details: String(error),
      timestamp: new Date()
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

/**
 * POST /api/tools/execute
 * Execute a tool with given parameters
 */
router.post('/execute', executionLimiter, async (req: Request, res: Response) => {
  try {
    const { toolName, parameters, context } = req.body; // context should be Partial<IToolExecutionContext>

    if (!toolName || !parameters) {
      const apiError: ApiError = {
        code: 'MISSING_PARAMETERS',
        message: 'Tool name and parameters are required',
        timestamp: new Date()
      };
      return res.status(400).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    }

    const ToolClass = tools[toolName];
    if (!ToolClass) {
      const apiError: ApiError = {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${toolName}' not found`,
        timestamp: new Date()
      };
      return res.status(404).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    }

    // Create tool instance and execution context
    const toolInstance = new ToolClass(); // tool was already used as variable name
    const executionContext = new WebToolExecutionContext(context || {}); // Pass context, ensure it's an object

    const result = await toolInstance.execute(parameters, executionContext);
    
    const responseData = {
      toolName,
      parameters,
      result,
      executedAt: new Date()
    };
    const response: ApiResponse<typeof responseData> = {
      success: true,
      data: responseData,
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    if (error instanceof ToolError) {
      const apiError: ApiError = {
        message: error.message,
        code: error.code,
        suggestions: error.suggestions,
        timestamp: new Date()
      };
      return res.status(400).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    }

    logger.error('Failed to execute tool', { error: { name: (error as Error).name, message: (error as Error).message, stack: (error as Error).stack }});
    const apiError: ApiError = {
      code: 'TOOL_EXECUTION_FAILED',
      message: 'Tool execution failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date()
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

export default router;
