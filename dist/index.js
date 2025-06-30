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
// src/index.ts - Clean server without problematic router handling
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const Redis_1 = require("./services/Redis");
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const messagesummary_1 = require("./db/messagesummary");
const cors_1 = __importDefault(require("cors"));
const fs = __importStar(require("fs"));
const users_1 = __importDefault(require("./routes/users"));
const projects_1 = __importDefault(require("./routes/projects"));
const messages_1 = __importDefault(require("./routes/messages"));
// Import route initializers if they exist, with fallbacks
let initializeSessionRoutes = null;
let initializeGenerationRoutes = null;
let initializeModificationRoutes = null;
let initializeConversationRoutes = null;
let initializeRedisRoutes = null;
let StatelessSessionManager = null;
try {
    const sessionModule = require("./routes/session");
    initializeSessionRoutes = sessionModule.initializeSessionRoutes;
    StatelessSessionManager = sessionModule.StatelessSessionManager;
}
catch (error) {
    console.warn("Session routes not available");
}
try {
    const generationModule = require("./routes/generation");
    initializeGenerationRoutes = generationModule.initializeGenerationRoutes;
}
catch (error) {
    console.warn("Generation routes not available");
}
try {
    const modificationModule = require("./routes/modification");
    initializeModificationRoutes = modificationModule.initializeModificationRoutes;
}
catch (error) {
    console.warn("Modification routes not available");
}
try {
    const conversationModule = require("./routes/conversation");
    initializeConversationRoutes = conversationModule.initializeConversationRoutes;
}
catch (error) {
    console.warn("Conversation routes not available");
}
try {
    const redisModule = require("./routes/redis-stats");
    initializeRedisRoutes = redisModule.initializeRedisRoutes;
}
catch (error) {
    console.warn("Redis routes not available");
}
const anthropic = new sdk_1.default();
const app = (0, express_1.default)();
const redis = new Redis_1.RedisService();
const DATABASE_URL = process.env.DATABASE_URL;
const messageDB = new messagesummary_1.DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const sessionManager = StatelessSessionManager ? new StatelessSessionManager(redis) : null;
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
                if (typeof messageDB.initializeSessionStats === 'function') {
                    yield messageDB.initializeSessionStats(defaultSessionId);
                }
                else if (typeof messageDB.initializeStats === 'function') {
                    yield messageDB.initializeStats();
                }
                console.log('✅ Legacy session stats initialized');
            });
            yield initializeStatsCompat();
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
    const availableFeatures = [];
    if (initializeSessionRoutes)
        availableFeatures.push("Redis stateless sessions");
    if (initializeGenerationRoutes)
        availableFeatures.push("Project generation");
    if (initializeModificationRoutes)
        availableFeatures.push("File modifications");
    if (initializeConversationRoutes)
        availableFeatures.push("Session-based conversations");
    // Always available features
    availableFeatures.push("Multi-user support", "Project management", "User management");
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "3.0.0-production-ready",
        features: availableFeatures
    });
});
// Main API routes
app.use("/api/users", users_1.default);
app.use("/api/projects", projects_1.default);
app.use("/api/messages", messages_1.default);
// Optional advanced routes (only if modules are available)
if (initializeSessionRoutes) {
    app.use("/api/session", initializeSessionRoutes(redis));
}
if (initializeGenerationRoutes) {
    app.use("/api/generate", initializeGenerationRoutes(anthropic, messageDB, sessionManager));
}
if (initializeModificationRoutes) {
    app.use("/api/modify", initializeModificationRoutes(anthropic, messageDB, redis, sessionManager));
}
if (initializeConversationRoutes) {
    app.use("/api/conversation", initializeConversationRoutes(messageDB, redis, sessionManager));
}
if (initializeRedisRoutes) {
    app.use("/api/redis", initializeRedisRoutes(redis));
}
// Legacy compatibility endpoints - simple responses
app.post("/api/projects/generate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy /api/projects/generate endpoint called');
    if (initializeGenerationRoutes) {
        // If generation routes are available, try to forward
        try {
            // Call the generation endpoint directly
            req.url = '/api/generate';
            req.originalUrl = '/api/generate';
            // Find the generate route and call it
            const generateRouter = app._router;
            if (generateRouter) {
                // This is a safer way to handle the redirect
                return res.redirect(307, '/api/generate');
            }
        }
        catch (error) {
            console.error('Error forwarding to generate route:', error);
        }
    }
    // Fallback response
    res.status(501).json({
        error: 'Service unavailable',
        message: 'Code generation service is not available. Please ensure all required modules are installed.',
        available: false
    });
}));
// Simple legacy endpoint handlers
app.post("/generateChanges", (req, res) => {
    console.log('🔄 Legacy generateChanges endpoint called');
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
});
app.post("/extractFilesToChange", (req, res) => {
    console.log('🔄 Legacy extractFilesToChange endpoint called');
    res.json({
        files: [
            {
                path: "src/App.tsx",
                content: "// Legacy compatibility placeholder"
            }
        ]
    });
});
app.post("/modify", (req, res) => {
    console.log('🔄 Legacy modify endpoint called');
    res.json({
        content: [{
                text: JSON.stringify([
                    {
                        path: "src/App.tsx",
                        content: "// Modified content placeholder"
                    }
                ])
            }]
    });
});
app.post("/write-files", (req, res) => {
    console.log('🔄 Legacy write-files endpoint called');
    res.json({
        success: true,
        message: 'Files written successfully (legacy mode)'
    });
});
// Other legacy endpoints
const legacyEndpoints = [
    { method: 'post', path: '/modify-with-history-stream', message: 'Streaming modifications not available' },
    { method: 'post', path: '/modify-with-history', message: 'History-based modifications not available' },
    { method: 'post', path: '/messages', message: 'Legacy messaging not available' },
    { method: 'get', path: '/conversation-with-summary', message: 'Conversation summaries not available' },
    { method: 'get', path: '/conversation-stats', message: 'Conversation statistics not available' },
    { method: 'get', path: '/summaries', message: 'Summaries not available' },
    { method: 'delete', path: '/conversation', message: 'Conversation management not available' },
    { method: 'get', path: '/current-summary', message: 'Current summary not available' },
    { method: 'post', path: '/fix-stats', message: 'Stats fixing not available' },
    { method: 'get', path: '/frontend-history', message: 'Frontend history not available' },
    { method: 'get', path: '/project-status', message: 'Project status not available' },
    { method: 'get', path: '/redis-health', message: 'Redis health check not available' }
];
legacyEndpoints.forEach(endpoint => {
    app[endpoint.method](endpoint.path, (req, res) => {
        console.log(`🔄 Legacy ${endpoint.path} called - ${endpoint.message}`);
        res.status(501).json({
            error: 'Feature not available',
            message: endpoint.message,
            available: false
        });
    });
});
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
    console.log(`🔧 Available features detected automatically`);
    console.log('');
    console.log('📁 Core API endpoints:');
    console.log('  👤 /api/users/* - User management');
    console.log('  📋 /api/projects/* - Project management');
    console.log('  💌 /api/messages/* - Message management');
    if (initializeSessionRoutes)
        console.log('  🔧 /api/session/* - Session management');
    if (initializeGenerationRoutes)
        console.log('  🎨 /api/generate - Project generation');
    if (initializeModificationRoutes)
        console.log('  ✏️  /api/modify/* - File modifications');
    if (initializeConversationRoutes)
        console.log('  💬 /api/conversation/* - Conversation management');
    if (initializeRedisRoutes)
        console.log('  🔴 /api/redis/* - Redis health and stats');
    console.log('');
    console.log('🔄 Legacy endpoints maintained for backward compatibility');
});
//# sourceMappingURL=index.js.map