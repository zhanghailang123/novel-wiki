// src/ingest/extractor.ts
import { client, modelName } from "../config.js";
import { ChapterLedger, ChapterLedgerSchema } from "./schema.js";
/**
 * 结构化抽取工具契约定义（保持与 Worker 工具风格一致）
 */
const INGEST_TOOL_DEF = {
    name: "submit_chapter_ledger",
    description: "提交本章提取的结构化事实账本（用于 Wiki 规划、设定索引与仿写素材库）",
    schema: ChapterLedgerSchema,
    parameters: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "本章标题（如《他惊人的毅力并无观众》）",
            },
            summary: {
                type: "string",
                description: "本章核心剧情的精炼客观摘要（100字左右，禁止主观抒情）",
            },
            characters: {
                type: "array",
                description: "本章登场或关键提及的人物动态与状态演变",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "人物姓名" },
                        action: { type: "string", description: "本章核心行为或动态" },
                        statusChange: {
                            type: "string",
                            description: "状态关键变更（如重伤、突破、死亡、获得信物等），若无留空",
                        },
                    },
                    required: ["name", "action"],
                },
            },
            factions: {
                type: "array",
                description: "本章涉及或提及的宗门、国家、城池、世家势力名称",
                items: { type: "string" },
            },
            systems: {
                type: "array",
                description: "本章涉及的修炼体系、功法神通、法宝灵药或天地异象",
                items: { type: "string" },
            },
            significantEvents: {
                type: "array",
                description: "本章发生的重大转折或标志性历史事件",
                items: { type: "string" },
            },
            foreshadowing: {
                type: "array",
                description: "本章出现的暗线伏笔或未解之谜（如神秘令牌、密谋、未知来源之物）",
                items: { type: "string" },
            },
            narrativeBeat: {
                type: "string",
                description: "本章在全书故事推进中的叙事节拍（如：蓄势铺垫、危机降临、高潮决战、余韵收尾）",
            },
            styleHighlights: {
                type: "array",
                description: "本章中极具作者文风特色的金句、精妙比喻或战斗意境描写（1~3句，供仿写参考）",
                items: { type: "string" },
            },
        },
        required: [
            "title",
            "summary",
            "characters",
            "factions",
            "systems",
            "significantEvents",
            "foreshadowing",
        ],
    },
};

const SYSTEM_PROMPT = `你是一位严谨专业的小说原著事实抽取专家与文学剖析者。
你的任务是将提供的章节文本精准提取为结构化的【事实账本（Chapter Ledger）】。
【提取准则】
1. 绝对忠于原文：严禁根据全书后续剧情剧透或过度脑补，仅提取本章实际发生的确定事实；
2. 实体精准识别：提取人物、势力、功法时保留原著规范称谓；
3. 状态流动追踪：特别注意人物的生死、重伤、境界突破、信物转移等状态流转；
4. 节拍与文风提炼：客观提炼该章的叙事节拍类型与最能体现作者文笔功力的 1~2 处特色描写；
5. 必须通过调用 submit_chapter_ledger 函数返回结果，不得输出任何其他自然语言解释。`;

export async function extractChapterLedger(
    chapterNum: number,
    chapterText: string,
    maxRetries: number = 2
): Promise<ChapterLedger> {
    let attempts = 0;
    let lastError: Error | null = null;

    //组装符合OpenAI规范的工具列表

    const openAiTools = [
        {
            type: "function" as const,
            function: {
                name: INGEST_TOOL_DEF.name,
                description: INGEST_TOOL_DEF.description,
                parameters: INGEST_TOOL_DEF.parameters,
            },
        },
    ];

    while (attempts <= maxRetries) {
        attempts++;

        try {
            const messages: any[] = [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `请对以下[第${chapterNum}章] 正文执行事实抽取：\n\n ${chapterText}` },
            ];

            if (lastError) {
                messages.push({
                    role: "user",
                    content: `注意：上一次提取的数据未通过校验，错误如下：${lastError.message}。 请严格按照要求重新生成`,
                });
            }

            const response = await client.chat.completions.create(
                {
                    model: modelName,
                    messages,
                    tools: openAiTools,
                    tool_choice: {
                        type: "function",
                        function: {
                            name: INGEST_TOOL_DEF.name,
                        },
                    },
                    temperature: 0.1,
                }
            );

            const message = response.choices[0]?.message;

            //这里的问号起到什么作用？
            const toolCall = message?.tool_calls?.[0];

            // 加上 toolCall.type !== "function" 类型守卫
            if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== INGEST_TOOL_DEF.name) {
                throw new Error(`模型未按要求调用 ${INGEST_TOOL_DEF.name} 函数。`);
            }

            const rawArguments = JSON.parse(toolCall.function.arguments);

            //严格使用工具绑定的 schema进行类型校验
            const ledgerData = INGEST_TOOL_DEF.schema.parse({
                chapter: chapterNum,
                ...rawArguments,
            });

            return ledgerData;
        } catch (error: any) {
            lastError = error;
            console.warn(`⚠️ [Ingest] 第 ${chapterNum} 章提取第 ${attempts} 次尝试失败: ${error.message}`);

            if (attempts > maxRetries) {
                throw new Error(
                    `第 ${chapterNum} 章经过 ${maxRetries} 次重试后提取仍然失败: ${lastError?.message}`
                );
            }
        }

    }
    throw lastError || new Error("未知抽取异常");
}