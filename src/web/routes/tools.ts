import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ToolError, ToolErrorCode } from '../../shared/tools/types';
import { ApiResponse, ApiError } from '../types/api';
import { validateRequest } from '../middleware/validation';
import { tools } from '../../shared/tools';
import { IToolExecutionContext } from '../../shared/interfaces/IToolExecutionContext';
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
  message: 'Too many tool executions, please try again later'
});

/**
 * GET /api/tools
 * List all available tools with descriptions and schemas
 */
router.get('/', async (req, res) => {
  try {
    const toolList = getTools();

    const response: ApiResponse<any[]> = {
      success: true,
      data: toolList.map(tool => ({
        name: tool.name,
        description: tool.description,
        schema: tool.schema
      })),
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to list tools', error);

    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'TOOL_LIST_ERROR',
        message: 'Failed to retrieve tools list'
      },
      timestamp: new Date()
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/tools/:toolName
 * Get detailed information about a specific tool
 */
router.get('/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const tool = getToolByName(toolName);

    if (!tool) {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${toolName}' not found`
        },
        timestamp: new Date()
      };

      return res.status(404).json(response);
    }

    const response: ApiResponse<any> = {
      success: true,
      data: {
        name: tool.name,
        description: tool.description,
        schema: tool.schema
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get tool details', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to retrieve tool details',
      timestamp: new Date()
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/tools/category/:category
 * Get tools by category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const categorizedTools = getToolsByCategory();

    if (!(category in categorizedTools)) {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: `Category '${category}' not found`
        },
        timestamp: new Date()
      };

      return res.status(404).json(response);
    }

    const response: ApiResponse<any[]> = {
      success: true,
      data: categorizedTools[category as keyof typeof categorizedTools],
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get tools by category', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to retrieve tools by category',
      timestamp: new Date()
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/tools/execute
 * Execute a tool with given parameters
 */
router.post('/execute', executionLimiter, async (req, res) => {
  try {
    const { toolName, parameters, context } = req.body;

    if (!toolName || !parameters) {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Tool name and parameters are required'
        },
        timestamp: new Date()
      };

      return res.status(400).json(response);
    }

    const ToolClass = tools[toolName];
    if (!ToolClass) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Tool '${toolName}' not found`,
        timestamp: new Date()
      };

      return res.status(404).json(response);
    }

    // Create tool instance and execution context
    const tool = new ToolClass();
    const executionContext = new WebToolExecutionContext({
      ...context
    });

    const result = await tool.execute(parameters, executionContext);

    const response: ApiResponse<any> = {
      success: true,
      data: {
        toolName,
        parameters,
        result,
        executedAt: new Date()
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    if (error instanceof ToolError) {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          suggestions: error.suggestions
        } as ApiError,
        timestamp: new Date()
      };

      return res.status(400).json(response);
    }

    logger.error('Failed to execute tool', error);

    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: 'Tool execution failed',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date()
    };

    res.status(500).json(response);
  }
});

export default router;
