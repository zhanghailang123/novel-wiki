import z from "zod";

/**
 * 单条事实证据断言
 */
export const ClaimSchema = z.object(
    {
        statement: z.string().trim().min(1, "事实断言不能为空"),
        evidence: z
            .array(z.string().trim().min(1))
            .min(1, "每条事实必须至少附带一条原著证据（如 novel://ch001.txt#L10）")

    }
);

/**
 * 词条提交工具的入参契约
 */

export const SubmitLorePageSchema = z.object(
    {
        summary: z.string().trim().min(1, "词条的一句话总结不能少于5个字"),
        claims: z.array(ClaimSchema).min(1, "至少提炼 1 条核心事实断言与原著证据"),
    }
)

// {
//     summary: "总结",
//         claims: {
//         statement: "事实断言",
//             evidence: {
//             "xxx.txt",
//                 "yyyy.txt",
//         }
//     }
// }
export type SubmittedLorePage = z.infer<typeof SubmitLorePageSchema>;
