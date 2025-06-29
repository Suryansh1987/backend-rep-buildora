import express from "express";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { StatelessSessionManager } from './session';
import Anthropic from "@anthropic-ai/sdk";
export declare function initializeGenerationRoutes(anthropic: Anthropic, messageDB: DrizzleMessageHistoryDB, sessionManager: StatelessSessionManager): express.Router;
