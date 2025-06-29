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
class ProjectService {
    createProject(projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const newProject = yield db_1.db
                    .insert(project_schema_1.projects)
                    .values(Object.assign(Object.assign({}, projectData), { conversationTitle: projectData.conversationTitle || `${projectData.name} Chat` }))
                    .returning();
                return newProject[0];
            }
            catch (error) {
                console.error("Error creating project:", error);
                throw error;
            }
        });
    }
    getProjectsByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userProjects = yield db_1.db
                    .select()
                    .from(project_schema_1.projects)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(project_schema_1.projects.userId, userId), (0, drizzle_orm_1.eq)(project_schema_1.projects.status, "ready")))
                    .orderBy((0, drizzle_orm_1.desc)(project_schema_1.projects.updatedAt));
                return userProjects;
            }
            catch (error) {
                console.error("Error getting projects:", error);
                throw error;
            }
        });
    }
    getProjectById(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield db_1.db
                    .select()
                    .from(project_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(project_schema_1.projects.id, projectId))
                    .limit(1);
                return project[0] || null;
            }
            catch (error) {
                console.error("Error getting project:", error);
                throw error;
            }
        });
    }
    updateProject(projectId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedProject = yield db_1.db
                    .update(project_schema_1.projects)
                    .set(Object.assign(Object.assign({}, updates), { updatedAt: new Date() }))
                    .where((0, drizzle_orm_1.eq)(project_schema_1.projects.id, projectId))
                    .returning();
                return updatedProject[0];
            }
            catch (error) {
                console.error("Error updating project:", error);
                throw error;
            }
        });
    }
    deleteProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.db
                    .update(project_schema_1.projects)
                    .set({ status: "deleted", updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(project_schema_1.projects.id, projectId));
                return true;
            }
            catch (error) {
                console.error("Error deleting project:", error);
                throw error;
            }
        });
    }
}
exports.default = new ProjectService();
//# sourceMappingURL=projectService.js.map