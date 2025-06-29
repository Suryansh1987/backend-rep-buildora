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
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const project_schema_1 = require("../db/project_schema");
const drizzle_orm_1 = require("drizzle-orm");
class MessageService {
    createMessage(messageData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const newMessage = yield db_1.db
                    .insert(project_schema_1.messages)
                    .values(messageData)
                    .returning();
                // Update project's lastMessageAt
                yield db_1.db
                    .update(project_schema_1.projects)
                    .set({
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(project_schema_1.projects.id, messageData.projectId));
                return newMessage[0];
            }
            catch (error) {
                console.error('Error creating message:', error);
                throw error;
            }
        });
    }
    getMessagesByProjectId(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectMessages = yield db_1.db
                    .select()
                    .from(project_schema_1.messages)
                    .where((0, drizzle_orm_1.eq)(project_schema_1.messages.projectId, projectId))
                    .orderBy(project_schema_1.messages.createdAt);
                return projectMessages;
            }
            catch (error) {
                console.error('Error getting messages:', error);
                throw error;
            }
        });
    }
    deleteMessagesByProjectId(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.db
                    .delete(project_schema_1.messages)
                    .where((0, drizzle_orm_1.eq)(project_schema_1.messages.projectId, projectId));
                return true;
            }
            catch (error) {
                console.error('Error deleting messages:', error);
                throw error;
            }
        });
    }
}
exports.default = new MessageService();
//# sourceMappingURL=messageService.js.map