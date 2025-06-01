import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ToolError } from '../../shared/tools/types';
import { ApiResponse, ApiError, ErrorResponse } from '../types/api';
// import { validateRequest } from '../middleware/validation';
import { tools } from '../../shared/tools';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext'; // Added for casting context
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
const listToolsHandler: RequestHandler = async (req, res, _next) => {
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
    return;
  } catch (error) {
    logger.error('Failed to list tools', error as Error);
    const apiError: ApiError = {
      code: 'TOOL_LIST_ERROR',
      message: 'Failed to retrieve tools list',
      details: String(error),
      timestamp: new Date(),
      stack: (error instanceof Error) ? error.stack : undefined
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
};

/**
 * GET /api/tools/:toolName
 * Get detailed information about a specific tool
 */
const getToolByNameHandler: RequestHandler = async (req, res, _next) => {
  try {
    const { toolName } = req.params;
    const tool = getToolByName(toolName);

    if (!tool) {
      const apiError: ApiError = {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${toolName}' not found`,
        timestamp: new Date()
      };
      res.status(404).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
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
    return;
  } catch (error) {
    logger.error('Failed to get tool details', error as Error);
    const apiError: ApiError = {
      code: 'TOOL_DETAILS_ERROR',
      message: 'Failed to retrieve tool details',
      details: String(error),
      timestamp: new Date(),
      stack: (error instanceof Error) ? error.stack : undefined
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
};

/**
 * GET /api/tools/category/:category
 * Get tools by category
 */
const getToolsByCategoryHandler: RequestHandler = async (req, res, _next) => {
  try {
    const { category } = req.params;
    const categorizedTools = getToolsByCategory();

    if (!(category in categorizedTools)) {
      const apiError: ApiError = {
        code: 'CATEGORY_NOT_FOUND',
        message: `Category '${category}' not found`,
        timestamp: new Date()
      };
      res.status(404).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
    }

    const responseData = categorizedTools[category as keyof typeof categorizedTools];
    const response: ApiResponse<typeof responseData> = {
      success: true,
      data: responseData,
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    logger.error('Failed to get tools by category', error as Error);
    const apiError: ApiError = {
      code: 'TOOL_CATEGORY_ERROR',
      message: 'Failed to retrieve tools by category',
      details: String(error),
      timestamp: new Date(),
      stack: (error instanceof Error) ? error.stack : undefined
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
};

/**
 * POST /api/tools/execute
 * Execute a tool with given parameters
 */
const executeToolHandler: RequestHandler = async (req, res, _next) => {
  try {
    const { toolName, parameters, context } = req.body; // context should be Partial<IToolExecutionContext>

    if (!toolName || !parameters) {
      const apiError: ApiError = {
        code: 'MISSING_PARAMETERS',
        message: 'Tool name and parameters are required',
        timestamp: new Date()
      };
      res.status(400).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
    }

    const ToolClass = tools[toolName];
    if (!ToolClass) {
      const apiError: ApiError = {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${toolName}' not found`,
        timestamp: new Date()
      };
      res.status(404).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
    }

    // Create tool instance and execution context
    const toolInstance = new ToolClass();
    // Cast context to Partial<IToolExecutionContext> for type safety
    const executionContext = new WebToolExecutionContext(context as Partial<IToolExecutionContext> || {});

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
    return;
  } catch (error) {
    if (error instanceof ToolError) {
      const apiError: ApiError = {
        message: error.message,
        code: error.code,
        details: { 
          originalMessage: error.message,
          suggestions: error.suggestions,
        },
        timestamp: new Date(),
        stack: error.stack 
      };
      res.status(400).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
    }

    logger.error('Failed to execute tool', error as Error);
    const apiError: ApiError = {
      code: 'TOOL_EXECUTION_FAILED',
      message: 'Tool execution failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
      stack: (error instanceof Error) ? error.stack : undefined
    };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
};

router.get('/', listToolsHandler);
router.get('/:toolName', getToolByNameHandler);
router.get('/category/:category', getToolsByCategoryHandler);
router.post('/execute', executionLimiter, executeToolHandler);

export default router;
