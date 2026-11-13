import z, { properties } from "zod";
import { AgentTool } from "../agent/types.js";
import { safeWriteWikiPage } from "./sandbox.js";

const WriteWikiPageSchema = z.object({
    content: z.string().trim().min(20, "词条正文内容不能少于20个字"),
})

/**
 * 工厂函数创建一个绑定了唯一合法路径的沙箱写入工具
 */
export function createWriteWikiPageTool(
    rootDir: string,
    allowedPagePath: string,
    onWritten: () => void
): AgentTool<z.infer<typeof WriteWikiPageSchema>> {

    return {
        name: "write_wiki_page",
        description: `将撰写好的 Markdown 词条内容写入指定文件（当前仅允许写入: ${allowedPagePath}）。`,
        schema: WriteWikiPageSchema,
        parameters: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "将撰写好的完整 Markdown 词条正文写入文件。注意：必须把完整正文直接传入 content 参数，不要在普通对话中打印正文",
                },
            },
            required: ["content"],
        },
        execute: async ({ content }) => {
            console.log(`✍️ [WritePageTool] 正在向沙箱写入 ${allowedPagePath}...`);
            await safeWriteWikiPage(rootDir, allowedPagePath, content, allowedPagePath);
            onWritten();
            return JSON.stringify({ status: "success", path: allowedPagePath });
        },
    };
}