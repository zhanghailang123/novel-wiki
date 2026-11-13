// src/tools/read-ledger.ts
import { z } from "zod";
import { AgentTool } from "../agent/types.js";
import { formatLedgerSummaries, loadLedgerRange } from "../ingest/storage.js";

const ReadLedgerArgsSchema = z.object({
    startChapter: z.number().int().positive("起始章节必须为正整数"),
    endChapter: z.number().int().positive("结束章节必须为正整数"),
});

type ReadLedgerArgs = z.infer<typeof ReadLedgerArgsSchema>;

/**
 * 创建供 Planner 消费的事实账本读取工具
 */
export function createReadLedgerTool(
    rootDir: string
): AgentTool<ReadLedgerArgs> {
    return {
        name: "read_ledger_summaries",
        description:
            "【推荐首选】批量读取指定章节范围的高密度结构化事实账本摘要（包含登场人物动态、所属势力、修炼体系、重大转折事件与暗线伏笔）。一次调用即可掌握数十章全局脉络。",
        schema: ReadLedgerArgsSchema,
        parameters: {
            type: "object",
            properties: {
                startChapter: {
                    type: "integer",
                    description: "起始章节号（例如 1）",
                },
                endChapter: {
                    type: "integer",
                    description: "结束章节号（例如 10 或 20）",
                },
            },
            required: ["startChapter", "endChapter"],
        },
        execute: async (args: ReadLedgerArgs) => {
            console.log(
                `🔍 [ReadLedgerTool] 正在读取第 ${args.startChapter} ~ ${args.endChapter} 章的事实账本摘要...`
            );
            const ledgers = await loadLedgerRange(
                rootDir,
                args.startChapter,
                args.endChapter
            );
            if (ledgers.length === 0) {
                return `在第 ${args.startChapter} ~ ${args.endChapter} 章未找到任何已生成的账本。请确认是否已执行 Ingest 抽取。`;
            }
            return formatLedgerSummaries(ledgers);
        },
    };
}