// src/tools/sandbox.ts
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 安全读取小说指定章节正文
 * @param rootDir 项目根目录
 * @param chapterNum 章节序号（如 1 代表第一章）
 */
export async function readChapter(
    rootDir: string,
    chapterNum: number
): Promise<string> {
    // 规范化章节文件名：1 -> "ch001.txt", 4 -> "ch004.txt"
    const fileName = `ch${String(chapterNum).padStart(3, "0")}.txt`;
    const chapterPath = path.join(rootDir, "chapters", fileName);

    try {
        return await fs.readFile(chapterPath, "utf-8");
    } catch (error: any) {
        if (error.code === "ENOENT") {
            throw new Error(`找不到第 ${chapterNum} 章文件 (${fileName})，请确认章节是否存在。`);
        }
        throw error;
    }
}

/**
 * 沙箱写入工具：只允许写入分配给当前 Worker 的特定页面
 * 严禁跨页面覆盖或修改源码
 * 
 * @param rootDir 项目根目录
 * @param targetPagePath Worker 试图写入的目标路径（如 "wiki/characters/姜望.md"）
 * @param content 要写入的 Markdown 内容
 * @param allowedPagePath 调度器给当前 Worker 授权的唯一合法路径
 */
export async function safeWriteWikiPage(
    rootDir: string,
    targetPagePath: string,
    content: string,
    allowedPagePath: string
): Promise<void> {
    // 统一把 Windows 路径反斜杠 \ 转换为标准的 /，方便精准对比
    const normalizedTarget = path.normalize(targetPagePath).replace(/\\/g, "/");
    const normalizedAllowed = path.normalize(allowedPagePath).replace(/\\/g, "/");

    // 1. 严格权限检查：写入目标必须与被授权的页面完全一致
    if (normalizedTarget !== normalizedAllowed) {
        throw new Error(
            `【沙箱安全拒绝】当前 Worker 仅被授权写入 [${normalizedAllowed}]，拒绝写入 [${normalizedTarget}]！`
        );
    }

    // 2. 必须以 wiki/ 开头，严禁通过 ../ 逃逸到项目根目录或修改源码
    if (!normalizedTarget.startsWith("wiki/")) {
        throw new Error(`【沙箱安全拒绝】目标路径必须位于 wiki/ 目录下！`);
    }

    const fullPath = path.join(rootDir, normalizedTarget);

    // 3. 自动递归创建上层文件夹（例如 wiki/characters/ 自动生成）
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    // 4. 安全落盘
    await fs.writeFile(fullPath, content, "utf-8");
}