import fs from "node:fs/promises";
import path from "node:path";
import { JobStatus, NovelRunState, PageJob } from "./types.js";


const STATE_FILE_NAME = ".novel-run.json";

function getStateFilePath(rootDir: string): string {
    return path.join(rootDir, STATE_FILE_NAME);
}

/**
 * 尝试从磁盘加载现有的运行状态
 */

export async function loadRunState(rootDir: string): Promise<NovelRunState | null> {
    const filePath = getStateFilePath(rootDir);

    try {
        const content = await fs.readFile(filePath, "utf-8");
        const state: NovelRunState = JSON.parse(content);
        return state;
    } catch (error: any) {
        if (error.code == "ENOENT") {
            return null;
        }

        throw new Error(`加载状态文件失败:${error.message}`)
    }
}

/**
 * 初始化一个全新的状态
 */

export function createInitialState(novelId: string, fingerprint: string): NovelRunState {
    const now = new Date().toISOString();
    return {
        novelId,
        fingerprint,
        phase: "planning",
        createdAt: now,
        updatedAt: now
    }
}

/**
 * 将状态安全落盘到磁盘中
 */

export async function saveRunState(rootDir: string, state: NovelRunState): Promise<void> {
    const filePath = getStateFilePath(rootDir);
    state.updatedAt = new Date().toISOString();

    const content = JSON.stringify(state, null, 2);
    await fs.writeFile(filePath, content, "utf-8");
}

/**
 * 队列控制器:从规划树中寻找下一个等待生成的页面
 */

export function getNextPendingState(state: NovelRunState): PageJob | null {
    if (!state.plan || state.phase != "generating") {
        return null;
    }

    return state.plan.pages.find((job) => job.status == "pending") ?? null;
}

/**
 * 更新某个页面的作业状态
 */

export function updatePageStatus(state: NovelRunState, jobId: string, status: JobStatus): void {
    if (!state.plan) return;

    const job = state.plan.pages.find((job) => job.id === jobId);

    if (job) {
        job.status = status;
        job.updatedAt = new Date().toISOString();
    }
}

/**
 * 断点恢复重置：将上次意外中断卡在 running 或临时跳过的 skipped 页面，重置回 pending 等待重试
 * @returns 被重置的页面数量
 */
export function resetIncompletePages(state: NovelRunState): number {
    if (!state.plan) return 0;
    let resetCount = 0;
    for (const job of state.plan.pages) {
        if (job.status === "running" || job.status === "skipped") {
            job.status = "pending";
            job.updatedAt = new Date().toISOString();
            resetCount++;
        }
    }
    return resetCount;
}