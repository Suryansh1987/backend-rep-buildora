"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeMessageRoutes = initializeMessageRoutes;
// routes/messageRoutes.ts - Enhanced message routes with dynamic user handling
const express_1 = require("express");
const messageService_1 = __importDefault(require("../services/messageService"));
const router = (0, express_1.Router)();
// Initialize message service (would be done in main app file)
let messageService = null;
function initializeMessageRoutes(databaseUrl, anthropic, redisUrl) {
    // Create message service instance
    messageService = new messageService_1.default(databaseUrl, anthropic, redisUrl);
    // Initialize the service
    messageService.initialize().catch(error => {
        console.error('Failed to initialize message service:', error);
    });
    // Create message with enhanced user handling
    router.post('/', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const result = yield messageService.createMessage(req.body);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(400).json(result);
            }
        }
        catch (error) {
            console.error('Message creation error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Get messages for a specific user
    router.get('/user/:userId', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const userId = parseInt(req.params.userId);
            const limit = parseInt(req.query.limit) || 50;
            if (isNaN(userId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid user ID provided'
                });
                return;
            }
            const result = yield messageService.getUserMessages(userId, limit);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Get user messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Get messages for a specific session
    router.get('/session/:sessionId', (req, res) => __awaiter(this, void 0, void 0, function* () {
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
            const result = yield messageService.getSessionMessages(sessionId);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Get session messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Ensure user exists
    router.post('/user/ensure', (req, res) => __awaiter(this, void 0, void 0, function* () {
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
            const result = yield messageService.ensureUser(parseInt(userId), userData);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Ensure user error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Get user message statistics
    router.get('/user/:userId/stats', (req, res) => __awaiter(this, void 0, void 0, function* () {
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
            const result = yield messageService.getUserMessageStats(userId);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Get user stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Get conversation context for user
    router.get('/user/:userId/context', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const userId = parseInt(req.params.userId);
            const sessionId = req.query.sessionId;
            if (isNaN(userId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid user ID provided'
                });
                return;
            }
            const result = yield messageService.getUserConversationContext(userId, sessionId);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Get user context error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Export user conversation
    router.get('/user/:userId/export', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const userId = parseInt(req.params.userId);
            const format = req.query.format || 'json';
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
            const result = yield messageService.exportUserConversation(userId, format);
            if (result.success && result.data) {
                if (format === 'csv') {
                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', `attachment; filename="conversation-${userId}.csv"`);
                    res.send(result.data.content);
                }
                else {
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', `attachment; filename="conversation-${userId}.json"`);
                    res.json(result.data);
                }
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Export conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Delete user messages
    router.delete('/user/:userId', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const userId = parseInt(req.params.userId);
            const sessionId = req.query.sessionId;
            if (isNaN(userId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid user ID provided'
                });
                return;
            }
            const result = yield messageService.deleteUserMessages(userId, sessionId);
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Delete user messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Get service health
    router.get('/health', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const result = yield messageService.getServiceHealth();
            if (result.success) {
                const statusCode = ((_a = result.data) === null || _a === void 0 ? void 0 : _a.status) === 'healthy' ? 200 :
                    ((_b = result.data) === null || _b === void 0 ? void 0 : _b.status) === 'degraded' ? 200 : 503;
                res.status(statusCode).json(result);
            }
            else {
                res.status(503).json(result);
            }
        }
        catch (error) {
            console.error('Health check error:', error);
            res.status(503).json({
                success: false,
                error: 'Health check failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Cleanup old data
    router.post('/cleanup', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!messageService) {
                res.status(500).json({
                    success: false,
                    error: 'Message service not initialized'
                });
                return;
            }
            const { olderThanDays, userId, dryRun = true } = req.body;
            const result = yield messageService.cleanupOldData({
                olderThanDays,
                userId,
                dryRun
            });
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(500).json(result);
            }
        }
        catch (error) {
            console.error('Cleanup error:', error);
            res.status(500).json({
                success: false,
                error: 'Cleanup failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    // Bulk message creation (for migrations or batch operations)
    router.post('/bulk', (req, res) => __awaiter(this, void 0, void 0, function* () {
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
                    const result = yield messageService.createMessage(messageData);
                    results.push(result);
                    if (result.success)
                        successCount++;
                    else
                        errorCount++;
                }
                catch (error) {
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
        }
        catch (error) {
            console.error('Bulk message creation error:', error);
            res.status(500).json({
                success: false,
                error: 'Bulk operation failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    return router;
}
exports.default = router;
//# sourceMappingURL=messages.js.map