// src/planner/planner.ts
import { runAgentLoop } from "../agent/loop.js";
import { AgentTool } from "../agent/types.js";
import { saveRunState } from "../state.js";
import { createReadChapterTool } from "../tools/read-chapter.js";
import { NovelRunState, PageJob } from "../types.js";
import { NovelPlanSchema, SubmittedNovelPlan } from "./schema.js";

const PLANNER_SYSTEM_PROMPT = `你是一个长篇仙侠/玄幻网文架构分析专家。
你的任务是通过阅读小说开头章节，规划 Wiki 知识库词条蓝图。

【最高指令与硬性限制】
1. 你拥有工具 read_chapter 和 submit_novel_plan，必须通过工具推进任务；
2. 严禁直接在聊天文本中输出规划内容！任何文本形式的总结都是无效的；
3. 规划完成后，【必须且只能】调用 submit_novel_plan 工具提交最终蓝图；
4. 页面路径 path 必须以 "wiki/" 开头并以 ".md" 结尾（例如 "wiki/characters/姜望.md"）。`;

/**
 * 创建 Planner 专属的终结工具：submit_novel_plan
 */
function createSubmitPlanTool(
    rootDir: string,
    state: NovelRunState
): AgentTool<SubmittedNovelPlan> {
    return {
        name: "submit_novel_plan",
        description: "【唯一终结动作】提交整本小说的词条规划蓝图。分析完所有章节后必须调用此工具完成规划。",
        schema: NovelPlanSchema,
        isTerminator: true, // 声明它是终结工具，执行成功立即退出循环！
        parameters: {
            type: "object",
            properties: {
                novelTitle: { type: "string", description: "小说名称，例如'赤心巡天'" },
                totalChapters: { type: "integer", description: "已分析的章节总数" },
                pages: {
                    type: "array",
                    description: "规划的词条页面列表",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "唯一标识，如'char-jiangwang'" },
                            path: { type: "string", description: "必须以 wiki/ 开头，如'wiki/characters/姜望.md'" },
                            title: { type: "string", description: "词条标题，如'主角·姜望'" },
                            category: {
                                type: "string",
                                enum: ["character", "faction", "system", "plot"],
                                description: "分类：character(人物), faction(势力), system(体系), plot(伏笔)",
                            },
                            seedChapters: {
                                type: "array",
                                items: { type: "integer" },
                                description: "该词条相关的章节号，如 [1, 2, 3, 4]",
                            },
                            purpose: { type: "string", description: "该页面的核心记录要点" },
                        },
                        required: ["id", "path", "title", "category", "seedChapters", "purpose"],
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
                pages: validatedPlan.pages.map((p): PageJob => ({
                    id: p.id,
                    path: p.path,
                    title: p.title,
                    category: p.category,
                    seedChapters: p.seedChapters,
                    status: "pending",
                })),
            };

            await saveRunState(rootDir, state);
            console.log(`🎉 [Planner] 规划成功并落盘！共规划了 ${state.plan.pages.length} 个词条！`);
            return JSON.stringify({ status: "success", pageCount: state.plan.pages.length });
        },
    };
}

/**
 * 运行规划器 Agent（现在极其清爽！）
 */
export async function runPlannerAgent(
    rootDir: string,
    state: NovelRunState,
    totalAvailableChapters: number
): Promise<void> {
    await runAgentLoop({
        agentName: "Planner",
        systemPrompt: PLANNER_SYSTEM_PROMPT,
        userPrompt: `当前小说有前 ${totalAvailableChapters} 章正文。请依次阅读它们，挖掘出人物、势力、体系与伏笔，并调用 submit_novel_plan 提交规划。`,
        tools: [
            createReadChapterTool(rootDir),
            createSubmitPlanTool(rootDir, state),
        ],
    });
}