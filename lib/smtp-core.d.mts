export interface SmtpStep { command: string | null; expect: number; secret?: boolean; optional?: boolean }
export declare function headerText(value: unknown): string;
export declare function addressOf(value: unknown): string | null;
export declare function encodeHeader(value: unknown): string;
export declare function buildMessage(input: { from: string; to: string; subject: string; text: string; date?: Date; messageId?: string }): string;
export declare function readReplies(buffer: string): { replies: { code: number; text: string }[]; rest: string };
export declare function conversation(input: { user: string; pass: string; from: string; to: string; message: string; heloName?: string }): SmtpStep[];
export declare function runConversation(socket: { write(data: string): unknown; on(event: string, listener: (...args: never[]) => void): unknown; end(): unknown }, steps: SmtpStep[], timeoutMs?: number): Promise<string | null>;
