import { type Message, type NewMessage } from '../db/project_schema';
declare class MessageService {
    createMessage(messageData: NewMessage): Promise<Message>;
    getMessagesByProjectId(projectId: number): Promise<Message[]>;
    deleteMessagesByProjectId(projectId: number): Promise<boolean>;
}
declare const _default: MessageService;
export default _default;
