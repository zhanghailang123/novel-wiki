import z from "zod";
import { AgentTool } from "../agent/types.js";
import { readChapter } from "./sandbox.js";

const ReadChapterSchema = z.object({
    chapterNum: z.number().int().positive("章节号必须是正整数"),
});

export function createReadChapterTool(rootDir: string): AgentTool<z.infer<typeof ReadChapterSchema>> {
    return {
        name: "read_chapter",
        description: "读取指定章节的小说正文内容，深入了解剧情、人物细节和事实依据。",
        schema: ReadChapterSchema,
        parameters: {
            type: "object",
            properties: {
                chapterNum: {
                    type: "integer",
                    description: "要读取的章节序号，例如 1 代表 第 1 章",
                },
            },
            required: ["chapterNum"],
        },

        execute: async ({ chapterNum }) => {
            console.log(`[ReadChapterTool] 正在读取第${chapterNum}章...`)
            const text = await readChapter(rootDir, chapterNum);
            return `【第${chapterNum}章内容如下】：\n ${text}`;
        },
    };
}