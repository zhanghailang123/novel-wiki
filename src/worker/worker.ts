import { AgentTool } from "../agent/types.js";
import { PageJob } from "../types.js";
import { SubmitLorePageSchema, SubmittedLorePage } from "./schema.js";
import path from "path";
import fs from "node:fs/promises";
import { runAgentLoop } from "../agent/loop.js";
import { createReadChapterTool } from "../tools/read-chapter.js";
import { createWriteWikiPageTool } from "../tools/write-page.js";

/**
 * 创建Worker专属终结工具： submit_lore_page
 */

function createSubmitLorePageTool(
    rootDir: string,
    job: PageJob,
    hasWritten: () => boolean,
): AgentTool<SubmittedLorePage> {
    return {
        name: "submit_lore_page",
        description: "【唯一终结动作】在成功调用 write_wiki_page 写入词条正文后，调用此工具提交结构化的事实断言（Claims）与原著证据。",
        schema: SubmitLorePageSchema,
        isTerminator: true,
        parameters: {
            type: "object",
            properties: {
                summary: {
                    type: "string",
                    description: "该词条的核心一句话总结",
                },
                claims: {
                    type: "array",
                    description: "提炼该词条的核心事实断言，并严格锚定原著出处",
                    items: {
                        type: "object",
                        properties: {
                            statement: {
                                type: "string",
                                description: "客观的事实陈述",
                            },
                            evidence: {
                                type: "array",
                                description: "原著出处，格式如: novel://ch001.txt#L10-L20 或 novel://ch003.txt",
                                items: {
                                    type: "string",
                                },
                            },
                        },
                        required: ["statement", "evidence"],
                    },
                },
            },
            required: ["summary", "claims"],
        },
        execute: async (validated) => {
            // 拦截规则：如果还没写文件就想交卷，直接抛出错误，通用 Loop 会自动退回让模型重写！
            if (!hasWritten()) {
                throw new Error("你尚未成功调用 write_wiki_page 写入词条正文文件，请先写文件再提交！");
            }
            // 将证据侧边账本落盘到 wiki/.claims/<job.id>.json（借鉴 OpenWiki 设计）
            const claimsDir = path.join(rootDir, "wiki", ".claims");
            await fs.mkdir(claimsDir, { recursive: true });
            const claimsPath = path.join(claimsDir, `${job.id}.json`);
            await fs.writeFile(
                claimsPath,
                JSON.stringify(
                    {
                        pageId: job.id,
                        pagePath: job.path,
                        summary: validated.summary,
                        claims: validated.claims,
                        updatedAt: new Date().toISOString(),
                    },
                    null,
                    2
                ),
                "utf-8"
            );
            console.log(`✅ [Worker:${job.title}] 交付成功！提炼了 ${validated.claims.length} 条原著证据并落盘至 .claims！`);
            return JSON.stringify({ status: "success", claimCount: validated.claims.length });
        }

    }
}


/**
 * 为单个页面作业启动全新的隔离Page Worker
 */

export async function runPageWorkerAgent(
    rootDir: string,
    job: PageJob,
): Promise<void> {
    let written = false;

    const systemPrompt = `你是一个专注、严谨的长篇网文维基百科撰写专家。
你当前被分配的【唯一任务】是撰写词条：【${job.title}】。
目标路径限制为：${job.path}。
【执行纪律】
1. 首先调用 read_chapter 工具仔细研读关联章节（第 ${job.seedChapters.join(", ")} 章）；
2. 根据原文撰写客观、详实、排版精美的 Markdown 词条（包含：核心简介、关键事件/经历、人物关系/设定细节、原著出处标注）；
3. 调用 write_wiki_page 将 Markdown 写入授权文件；
4. 写入成功后，必须调用 submit_lore_page 提交结构化事实断言与证据锚点（如 novel://ch001.txt#L15）来完成任务！

严禁剧透】你只能严格依据本次 read_chapter 实际读到的原著正文来撰写！严禁掺杂任何未读章节内容或你自身预训练记忆中的后续设定！`;

    await runAgentLoop({
        agentName: `Worker:${job.title}`,
        systemPrompt,
        userPrompt: `请开始研读第 ${job.seedChapters.join(", ")} 章，完成【${job.title}】词条的撰写并提交！`,
        tools: [
            createReadChapterTool(rootDir),
            createWriteWikiPageTool(rootDir, job.path, () => {
                written = true;
            }),
            createSubmitLorePageTool(rootDir, job, () => written),
        ],
    });
}