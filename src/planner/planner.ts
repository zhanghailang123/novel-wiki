// src/planner/planner.ts
import { runAgentLoop } from "../agent/loop.js";
import { AgentTool } from "../agent/types.js";
import { saveRunState } from "../state.js";
import { createReadChapterTool } from "../tools/read-chapter.js";
import { createReadLedgerTool } from "../tools/read-ledger.js";
import { NovelRunState, PageJob } from "../types.js";
import { NovelPlanSchema, SubmittedNovelPlan } from "./schema.js";

const PLANNER_SYSTEM_PROMPT = `你是一个长篇仙侠/玄幻网文架构分析专家。
你的任务是通过研读小说事实账本（Ledger），规划出全面、系统、严密的 Wiki 知识库词条蓝图。

【核心工作法】
1. 优先调用 read_ledger_summaries 工具：一次性获取所有目标章节的事实账本。账本已为你浓缩了核心剧情、人物动态、势力分布、修炼体系与伏笔线索；
2. 如对个别特殊章节细节存疑，可辅助调用 read_chapter 精读原文；
3. 全面分析后，【必须且只能】调用 submit_novel_plan 工具提交最终蓝图；
4. 页面路径 path 必须以 "wiki/" 开头并以 ".md" 结尾（如 "wiki/characters/姜望.md"、"wiki/systems/道脉与九品制.md"）。`;

/**
 * 创建 Planner 专属的终结工具：submit_novel_plan
 */
function createSubmitPlanTool(
    rootDir: string,
    state: NovelRunState
): AgentTool<SubmittedNovelPlan> {
    return {
        name: "submit_novel_plan",
        description:
            "【唯一终结动作】提交整本小说的词条规划蓝图。分析完账本后必须调用此工具完成规划。",
        schema: NovelPlanSchema,
        isTerminator: true,
        parameters: {
            type: "object",
            properties: {
                novelTitle: {
                    type: "string",
                    description: "小说名称，例如'赤心巡天'",
                },
                totalChapters: {
                    type: "integer",
                    description: "已分析的章节总数",
                },
                pages: {
                    type: "array",
                    description: "规划的词条页面列表",
                    items: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                description: "唯一标识，如'char-jiangwang'",
                            },
                            path: {
                                type: "string",
                                description:
                                    "必须以 wiki/ 开头，如'wiki/characters/姜望.md'",
                            },
                            title: {
                                type: "string",
                                description: "词条标题，如'主角·姜望'",
                            },
                            category: {
                                type: "string",
                                enum: ["character", "faction", "system", "plot"],
                                description:
                                    "分类：character(人物), faction(势力), system(体系), plot(伏笔)",
                            },
                            seedChapters: {
                                type: "array",
                                items: { type: "integer" },
                                description: "该词条相关的章节号，如 [1, 2, 3, 4]",
                            },
                            purpose: {
                                type: "string",
                                description: "该页面的核心记录要点",
                            },
                        },
                        required: [
                            "id",
                            "path",
                            "title",
                            "category",
                            "seedChapters",
                            "purpose",
                        ],
                    },
                },
            },
            required: ["novelTitle", "totalChapters", "pages"],
        },
        execute: async (validatedPlan) => {
            console.log("📋 [Planner] 收到合法规划，正在落盘状态机...");
            state.phase = "generating";
            state.plan = {
                novelTitle: validatedPlan.novelTitle,
                totalChapters: validatedPlan.totalChapters,
                pages: validatedPlan.pages.map(
                    (p): PageJob => ({
                        id: p.id,
                        path: p.path,
                        title: p.title,
                        category: p.category,
                        seedChapters: p.seedChapters,
                        status: "pending",
                    })
                ),
            };

            await saveRunState(rootDir, state);
            console.log(
                `🎉 [Planner] 规划成功并落盘！共规划了 ${state.plan.pages.length} 个词条！`
            );
            return JSON.stringify({
                status: "success",
                pageCount: state.plan.pages.length,
            });
        },
    };
}

/**
 * 运行规划器 Agent
 */
export async function runPlannerAgent(
    rootDir: string,
    state: NovelRunState,
    totalAvailableChapters: number
): Promise<void> {
    await runAgentLoop({
        agentName: "Planner",
        systemPrompt: PLANNER_SYSTEM_PROMPT,
        userPrompt: `当前小说已为你准备好前 1 ~ ${totalAvailableChapters} 章的高密度事实账本。请调用 read_ledger_summaries 工具读取它们，完成全书维基词条规划并提交。`,
        tools: [
            createReadLedgerTool(rootDir),   // 👈 首选的高密度账本工具
            createReadChapterTool(rootDir),  // 👈 备用的单章精读工具
            createSubmitPlanTool(rootDir, state),
        ],
        maxTurns: 5, // 👈 基于账本规划，最多 3~5 轮即可搞定！
    });
}