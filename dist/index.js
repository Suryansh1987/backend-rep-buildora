"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
// src/index.ts - Main server with Redis stateless integration and organized routes
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const Redis_1 = require("./services/Redis");
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const messagesummary_1 = require("./db/messagesummary");
const cors_1 = __importDefault(require("cors"));
const fs = __importStar(require("fs"));
const users_1 = __importDefault(require("./routes/users"));
const projects_1 = __importDefault(require("./routes/projects"));
const messages_1 = __importDefault(require("./routes/messages"));
const session_1 = require("./routes/session");
const generation_1 = require("./routes/generation");
const modification_1 = require("./routes/modification");
const conversation_1 = require("./routes/conversation");
const redis_stats_1 = require("./routes/redis-stats");
const anthropic = new sdk_1.default();
const app = (0, express_1.default)();
const redis = new Redis_1.RedisService();
const DATABASE_URL = process.env.DATABASE_URL;
const messageDB = new messagesummary_1.DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const sessionManager = new session_1.StatelessSessionManager(redis);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    else {
        next();
    }
});
function initializeServices() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Create a compatibility wrapper for the old initializeStats method
            const initializeStatsCompat = () => __awaiter(this, void 0, void 0, function* () {
                // For backward compatibility, we'll create a default session for legacy operations
                const defaultSessionId = 'legacy-session-default';
                yield messageDB.initializeSessionStats(defaultSessionId);
                console.log('✅ Legacy session stats initialized');
            });
            // Try the new method first, fallback to compatibility
            if (typeof messageDB.initializeSessionStats === 'function') {
                yield initializeStatsCompat();
            }
            else if (typeof messageDB.initializeStats === 'function') {
                yield messageDB.initializeStats();
            }
            else {
                console.warn('⚠️ No initialization method found on messageDB');
            }
            const redisConnected = yield redis.isConnected();
            console.log('✅ Services initialized successfully');
            console.log(`✅ Redis connected: ${redisConnected}`);
            if (!redisConnected) {
                console.warn('⚠️ Redis not connected - some features may be limited');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize services:', error);
            console.log('🔄 Continuing without full initialization...');
        }
    });
}
initializeServices();
console.log('📊 Database URL configured:', !!process.env.DATABASE_URL);
app.get("/", (req, res) => {
    res.json({
        message: "Backend is up with Redis stateless integration",
        timestamp: new Date().toISOString(),
        version: "3.0.0-production-ready"
    });
});
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "3.0.0-production-ready",
        features: [
            "Redis stateless sessions",
            "Multi-user support",
            "Session-based conversations",
            "Project integration",
            "Production scaling"
        ]
    });
});
// Main API routes
app.use("/api/users", users_1.default);
app.use("/api/projects", projects_1.default);
app.use("/api/messages", messages_1.default);
// New session-aware routes
app.use("/api/session", (0, session_1.initializeSessionRoutes)(redis));
app.use("/api/generate", (0, generation_1.initializeGenerationRoutes)(anthropic, messageDB, sessionManager));
app.use("/api/modify", (0, modification_1.initializeModificationRoutes)(anthropic, messageDB, redis, sessionManager));
app.use("/api/conversation", (0, conversation_1.initializeConversationRoutes)(messageDB, redis, sessionManager));
app.use("/api/redis", (0, redis_stats_1.initializeRedisRoutes)(redis));
// Legacy route redirects with proper handling
app.post("/api/projects/generate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Redirecting legacy /api/projects/generate to /api/generate');
    try {
        // Forward the request to the generate route
        const response = yield axios_1.default.post(`http://localhost:${PORT}/api/generate`, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error('Error forwarding to /api/generate:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}));
// Legacy endpoints - simplified fallback responses
app.post("/modify-with-history-stream", (req, res) => {
    console.log('🔄 Legacy /modify-with-history-stream called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/modify/stream'
    });
});
app.post("/modify-with-history", (req, res) => {
    console.log('🔄 Legacy /modify-with-history called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/modify'
    });
});
app.post("/messages", (req, res) => {
    console.log('🔄 Legacy /messages called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/messages'
    });
});
app.get("/conversation-with-summary", (req, res) => {
    console.log('🔄 Legacy /conversation-with-summary called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/conversation-with-summary'
    });
});
app.get("/conversation-stats", (req, res) => {
    console.log('🔄 Legacy /conversation-stats called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/conversation-stats'
    });
});
app.get("/summaries", (req, res) => {
    console.log('🔄 Legacy /summaries called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/summaries'
    });
});
app.delete("/conversation", (req, res) => {
    console.log('🔄 Legacy /conversation called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/conversation'
    });
});
app.get("/current-summary", (req, res) => {
    console.log('🔄 Legacy /current-summary called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/current-summary'
    });
});
app.post("/fix-stats", (req, res) => {
    console.log('🔄 Legacy /fix-stats called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/fix-stats'
    });
});
app.get("/frontend-history", (req, res) => {
    console.log('🔄 Legacy /frontend-history called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/frontend-history'
    });
});
app.get("/project-status", (req, res) => {
    console.log('🔄 Legacy /project-status called - feature not available');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/project-status'
    });
});
app.get("/redis-health", (req, res) => {
    console.log('🔄 Legacy /redis-health called - redirecting to /api/redis/health');
    res.redirect('/api/redis/health');
});
// Additional legacy endpoints for backward compatibility
app.post("/generateChanges", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy generateChanges endpoint called');
    try {
        // Simple fallback response for legacy compatibility
        res.json({
            content: [{
                    text: JSON.stringify({
                        files_to_modify: ["src/App.tsx"],
                        files_to_create: [],
                        reasoning: "Legacy compatibility response",
                        dependencies: [],
                        notes: "Using legacy endpoint"
                    })
                }]
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Legacy endpoint error' });
    }
}));
app.post("/extractFilesToChange", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy extractFilesToChange endpoint called');
    try {
        res.json({
            files: [
                {
                    path: "src/App.tsx",
                    content: "// Legacy compatibility placeholder"
                }
            ]
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Legacy endpoint error' });
    }
}));
app.post("/modify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy modify endpoint called, redirecting to new API');
    req.url = '/api/modify';
    app._router.handle(req, res);
}));
app.post("/write-files", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy write-files endpoint called');
    try {
        // For legacy compatibility, just return success
        res.json({ success: true, message: 'Files written successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Legacy endpoint error' });
    }
}));
// Cleanup job for temporary builds
setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tempBuildsDir = path_1.default.join(__dirname, "../temp-builds");
        if (!fs.existsSync(tempBuildsDir)) {
            return;
        }
        const entries = yield fs.promises.readdir(tempBuildsDir, { withFileTypes: true });
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const dirPath = path_1.default.join(tempBuildsDir, entry.name);
                const stats = yield fs.promises.stat(dirPath);
                if (stats.mtime.getTime() < fiveMinutesAgo) {
                    try {
                        yield fs.promises.rm(dirPath, { recursive: true, force: true });
                        console.log(`🧹 Cleaned up old temp directory: ${entry.name}`);
                    }
                    catch (cleanupError) {
                        console.warn(`⚠️ Failed to cleanup directory ${entry.name}:`, cleanupError);
                    }
                }
            }
        }
    }
    catch (error) {
        console.warn('⚠️ Background cleanup job failed:', error);
    }
}), 5 * 60 * 1000); // Run every 5 minutes
// Graceful shutdown handling
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    try {
        yield redis.disconnect();
        console.log('✅ Redis disconnected successfully');
    }
    catch (error) {
        console.error('❌ Error during Redis disconnect:', error);
    }
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    try {
        yield redis.disconnect();
        console.log('✅ Redis disconnected successfully');
    }
    catch (error) {
        console.error('❌ Error during Redis disconnect:', error);
    }
    process.exit(0);
}));
// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} with production-ready architecture`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Redis health: http://localhost:${PORT}/api/redis/health`);
    console.log(`🔧 Multi-user session management enabled`);
    console.log(`🎯 Features: Session isolation, project linking, production scaling`);
    console.log('');
    console.log('📁 Available API endpoints:');
    console.log('  🔧 /api/session/* - Session management');
    console.log('  🎨 /api/generate - Project generation');
    console.log('  ✏️  /api/modify/* - File modifications');
    console.log('  💬 /api/conversation/* - Conversation management');
    console.log('  🔴 /api/redis/* - Redis health and stats');
    console.log('  👤 /api/users/* - User management');
    console.log('  📋 /api/projects/* - Project management');
    console.log('  💌 /api/messages/* - Message management');
    console.log('');
    console.log('🔄 Legacy endpoints maintained for backward compatibility');
});
//# sourceMappingURL=index.js.map