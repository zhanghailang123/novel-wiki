
/**
 * 任务当前所处的生命周期阶段
 */
export type RunPhase = "planning" | "generating" | "finalized";

/**
 * 单个页面的作业状态
 */
export type JobStatus = "pending" | "running" | "completed" | "skipped";

/**
 * 单个词条页面的规划信息
 */

export interface PageJob {
    id: string;
    path: string;
    title: string;
    category: "character" | "faction" | "system" | "plot";
    seedChapters: number[];
    status: JobStatus;
    updatedAt?: string; // ? 代替可选
}

/**
 * 规划器生成的全书词条蓝图
 */

export interface NovelPlan {
    novelTitle: string; // 小说名字
    totalChapters: number; //章节总数
    pages: PageJob[] //规划出的作业列表
}

export interface NovelRunState {
    novelId: string;
    fingerprint: string;
    phase: RunPhase;
    plan?: NovelPlan;
    createdAt: string;
    updatedAt: string;
}