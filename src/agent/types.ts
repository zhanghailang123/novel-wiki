import z from "zod";


export interface AgentTool<T = any> {
    name: string,
    description: string,
    parameters: Record<string, any>,
    schema: z.ZodType<T>,
    isTerminator?: boolean,
    execute: (args: T) => Promise<string>;
}

/**
 * 通用Agent loop 的配置参数
 */

export interface AgentLoopOptions {
    agentName: string; //日志标识？
    systemPrompt: string;
    userPrompt: string;
    tools: AgentTool[];
    maxTurns?: number;
}