// src/index.ts - Main server with Redis stateless integration and organized routes
import Anthropic from "@anthropic-ai/sdk";
import { RedisService } from './services/Redis';
import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import { DrizzleMessageHistoryDB } from './db/messagesummary';
import cors from "cors";
import { exec } from "child_process";
import * as fs from "fs";


import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects"; 
import messageRoutes from "./routes/messages";


import { initializeSessionRoutes, StatelessSessionManager } from "./routes/session";
import { initializeGenerationRoutes } from "./routes/generation";
import { initializeModificationRoutes } from "./routes/modification";
import { initializeConversationRoutes } from "./routes/conversation";
import { initializeRedisRoutes } from "./routes/redis-stats";


const anthropic = new Anthropic();
const app = express();
const redis = new RedisService();


const DATABASE_URL = process.env.DATABASE_URL!;
const messageDB = new DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const sessionManager = new StatelessSessionManager(redis);


app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  } else {
    next();
  }
});


async function initializeServices() {
  try {
    await messageDB.initializeStats();
    const redisConnected = await redis.isConnected();
    console.log('✅ Services initialized successfully');
    console.log(`✅ Redis connected: ${redisConnected}`);
    if (!redisConnected) {
      console.warn('⚠️ Redis not connected - some features may be limited');
    }
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
}

initializeServices();

console.log('📊 Database URL configured:', !!process.env.DATABASE_URL);


app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Backend is up with Redis stateless integration",
    timestamp: new Date().toISOString(),
    version: "2.0.0-stateless-redis"
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: "2.0.0-stateless-redis",
    features: [
      "Redis stateless sessions",
      "File caching",
      "Conversation context",
      "Modification history"
    ]
  });
});


app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/messages", messageRoutes);


app.use("/api/session", initializeSessionRoutes(redis));
app.use("/api/generate", initializeGenerationRoutes(anthropic, messageDB, sessionManager));
app.use("/api/modify", initializeModificationRoutes(anthropic, messageDB, redis, sessionManager));
app.use("/api/conversation", initializeConversationRoutes(messageDB, redis, sessionManager));
app.use("/api/redis", initializeRedisRoutes(redis));


app.post("/api/projects/generate", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /api/projects/generate to /api/generate');
  req.url = '/api/generate';
  app._router.handle(req, res);
});

app.post("/modify-with-history-stream", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /modify-with-history-stream to /api/modify/stream');
  req.url = '/api/modify/stream';
  app._router.handle(req, res);
});

app.post("/modify-with-history", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /modify-with-history to /api/modify');
  req.url = '/api/modify';
  app._router.handle(req, res);
});

app.post("/messages", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /messages to /api/conversation/messages');
  req.url = '/api/conversation/messages';
  app._router.handle(req, res);
});

app.get("/conversation-with-summary", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /conversation-with-summary to /api/conversation/conversation-with-summary');
  req.url = '/api/conversation/conversation-with-summary';
  app._router.handle(req, res);
});

app.get("/conversation-stats", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /conversation-stats to /api/conversation/conversation-stats');
  req.url = '/api/conversation/conversation-stats';
  app._router.handle(req, res);
});

app.get("/summaries", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /summaries to /api/conversation/summaries');
  req.url = '/api/conversation/summaries';
  app._router.handle(req, res);
});

app.delete("/conversation", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /conversation to /api/conversation/conversation');
  req.url = '/api/conversation/conversation';
  app._router.handle(req, res);
});

app.get("/current-summary", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /current-summary to /api/conversation/current-summary');
  req.url = '/api/conversation/current-summary';
  app._router.handle(req, res);
});

app.post("/fix-stats", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /fix-stats to /api/conversation/fix-stats');
  req.url = '/api/conversation/fix-stats';
  app._router.handle(req, res);
});

app.get("/frontend-history", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /frontend-history to /api/conversation/frontend-history');
  req.url = '/api/conversation/frontend-history';
  app._router.handle(req, res);
});

app.get("/project-status", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /project-status to /api/conversation/project-status');
  req.url = '/api/conversation/project-status';
  app._router.handle(req, res);
});

app.get("/redis-health", (req: Request, res: Response) => {
  console.log('🔄 Redirecting legacy /redis-health to /api/redis/health');
  req.url = '/api/redis/health';
  app._router.handle(req, res);
});


setInterval(async () => {
  try {
    const tempBuildsDir = path.join(__dirname, "../temp-builds");
    
    if (!fs.existsSync(tempBuildsDir)) {
      return;
    }
    
    const entries = await fs.promises.readdir(tempBuildsDir, { withFileTypes: true });
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(tempBuildsDir, entry.name);
        const stats = await fs.promises.stat(dirPath);
        
        if (stats.mtime.getTime() < fiveMinutesAgo) {
          try {
            await fs.promises.rm(dirPath, { recursive: true, force: true });
            console.log(`🧹 Cleaned up old temp directory: ${entry.name}`);
          } catch (cleanupError) {
            console.warn(`⚠️ Failed to cleanup directory ${entry.name}:`, cleanupError);
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Background cleanup job failed:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes



// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  try {
    await redis.disconnect();
    console.log('✅ Redis disconnected successfully');
  } catch (error) {
    console.error('❌ Error during Redis disconnect:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  try {
    await redis.disconnect();
    console.log('✅ Redis disconnected successfully');
  } catch (error) {
    console.error('❌ Error during Redis disconnect:', error);
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with Redis stateless integration`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Redis health: http://localhost:${PORT}/api/redis/health`);
  console.log(`🔧 Using organized routes with Redis session backing`);
  console.log(`🎯 Features: File caching, session management, conversation context`);
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
});