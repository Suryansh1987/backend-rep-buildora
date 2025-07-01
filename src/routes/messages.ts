// routes/messageRoutes.ts - Enhanced message routes with dynamic user handling
import { Router, Request, Response } from 'express';
import MessageService from '../services/messageService';
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Initialize message service (would be done in main app file)
let messageService: MessageService | null = null;

export function initializeMessageRoutes(
  databaseUrl: string,
  anthropic: Anthropic,
  redisUrl?: string
): Router {
  
  // Create message service instance
  messageService = new MessageService(databaseUrl, anthropic, redisUrl);
  
  // Initialize the service
  messageService.initialize().catch(error => {
    console.error('Failed to initialize message service:', error);
  });

  // Create message with enhanced user handling
  router.post('/', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const result = await messageService.createMessage(req.body);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Message creation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get messages for a specific user
  router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 50;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID provided'
        });
        return;
      }

      const result = await messageService.getUserMessages(userId, limit);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Get user messages error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get messages for a specific session
  router.get('/session/:sessionId', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      const result = await messageService.getSessionMessages(sessionId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Get session messages error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Ensure user exists
  router.post('/user/ensure', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const { userId, userData } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      const result = await messageService.ensureUser(parseInt(userId), userData);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Ensure user error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user message statistics
  router.get('/user/:userId/stats', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID provided'
        });
        return;
      }

      const result = await messageService.getUserMessageStats(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get conversation context for user
  router.get('/user/:userId/context', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const userId = parseInt(req.params.userId);
      const sessionId = req.query.sessionId as string;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID provided'
        });
        return;
      }

      const result = await messageService.getUserConversationContext(userId, sessionId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Get user context error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Export user conversation
  router.get('/user/:userId/export', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const userId = parseInt(req.params.userId);
      const format = (req.query.format as 'json' | 'csv') || 'json';

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID provided'
        });
        return;
      }

      if (!['json', 'csv'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format. Must be json or csv'
        });
        return;
      }

      const result = await messageService.exportUserConversation(userId, format);
      
      if (result.success && result.data) {
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="conversation-${userId}.csv"`);
          res.send(result.data.content);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="conversation-${userId}.json"`);
          res.json(result.data);
        }
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Export conversation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete user messages
  router.delete('/user/:userId', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const userId = parseInt(req.params.userId);
      const sessionId = req.query.sessionId as string;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID provided'
        });
        return;
      }

      const result = await messageService.deleteUserMessages(userId, sessionId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Delete user messages error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get service health
  router.get('/health', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const result = await messageService.getServiceHealth();
      
      if (result.success) {
        const statusCode = result.data?.status === 'healthy' ? 200 : 
                          result.data?.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(result);
      } else {
        res.status(503).json(result);
      }
    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({ 
        success: false, 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Cleanup old data
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const { olderThanDays, userId, dryRun = true } = req.body;

      const result = await messageService.cleanupOldData({
        olderThanDays,
        userId,
        dryRun
      });
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk message creation (for migrations or batch operations)
  router.post('/bulk', async (req: Request, res: Response) => {
    try {
      if (!messageService) {
        res.status(500).json({ 
          success: false, 
          error: 'Message service not initialized' 
        });
        return;
      }

      const { messages } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Messages array is required and must not be empty'
        });
        return;
      }

      if (messages.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Maximum 100 messages allowed per bulk operation'
        });
        return;
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const messageData of messages) {
        try {
          const result = await messageService.createMessage(messageData);
          results.push(result);
          if (result.success) successCount++;
          else errorCount++;
        } catch (error) {
          results.push({
            success: false,
            error: 'Failed to create message',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }

      res.json({
        success: errorCount === 0,
        data: {
          totalMessages: messages.length,
          successCount,
          errorCount,
          results
        }
      });

    } catch (error) {
      console.error('Bulk message creation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Bulk operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default router;