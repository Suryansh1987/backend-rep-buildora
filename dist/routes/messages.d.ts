import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
declare const router: import("express-serve-static-core").Router;
export declare function initializeMessageRoutes(databaseUrl: string, anthropic: Anthropic, redisUrl?: string): Router;
export default router;
