// src/planner/schema.ts
import { z } from "zod";

/**
 * 单个页面的规划契约校验
 */
export const PlanPageSchema = z.object({
    id: z.string().trim().min(1, "页面 ID 不能为空"),
    path: z.string().trim().regex(/^wiki\/.+\.md$/, "路径必须以 wiki/ 开头且为 .md 文件"),
    title: z.string().trim().min(1, "标题不能为空"),
    // src/planner/schema.ts
    category: z.enum(["character", "faction", "system", "plot"], {
        message: "分类必须是 character, faction, system, plot 之一",
    }),
    seedChapters: z.array(z.number().int().positive()).min(1, "至少需要关联一个章节号"),
    purpose: z.string().trim().min(5, "页面作用说明不能少于 5 个字"),
});

/**
 * 完整规划树的契约校验
 */
export const NovelPlanSchema = z.object({
    novelTitle: z.string().trim().min(1, "小说名称不能为空"),
    totalChapters: z.number().int().positive(),
    pages: z.array(PlanPageSchema).min(1, "至少需要规划一个 Wiki 词条页面"),
});

// 从 Zod Schema 自动推导出 TypeScript 类型
export type SubmittedNovelPlan = z.infer<typeof NovelPlanSchema>;

