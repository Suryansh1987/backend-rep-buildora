import { type Project, type NewProject } from "../db/project_schema";
declare class ProjectService {
    createProject(projectData: NewProject): Promise<Project>;
    getProjectsByUserId(userId: number): Promise<Project[]>;
    getProjectById(projectId: number): Promise<Project | null>;
    updateProject(projectId: number, updates: Partial<Project>): Promise<Project>;
    deleteProject(projectId: number): Promise<boolean>;
}
declare const _default: ProjectService;
export default _default;
