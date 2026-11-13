// src/ingest/storage.ts
import fs from "node:fs/promises";
import path from "node:path";
import { ChapterLedger, ChapterLedgerSchema } from "./schema.js";

/**
 * 格式化章节文件名
 * 1 -> "ch001.json", 24 -> "ch024.json"
 */
export function getLedgerFileName(chapterNum: number): string {
    return `ch${String(chapterNum).padStart(3, "0")}.json`;
}

/**
 * 获取账本目录路径
 */
export function getLedgerDir(rootDir: string): string {
    return path.join(rootDir, "ledger");
}

/**
 * 检查指定章节是否已有账本（用于断点秒级跳过）
 */
export async function hasLedger(
    rootDir: string,
    chapterNum: number
): Promise<boolean> {
    const filePath = path.join(getLedgerDir(rootDir), getLedgerFileName(chapterNum));
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * 保存单章账本至磁盘
 */
export async function saveLedger(
    rootDir: string,
    ledger: ChapterLedger
): Promise<void> {
    const ledgerDir = getLedgerDir(rootDir);
    await fs.mkdir(ledgerDir, { recursive: true });

    const filePath = path.join(ledgerDir, getLedgerFileName(ledger.chapter));
    const content = JSON.stringify(ledger, null, 2);
    await fs.writeFile(filePath, content, "utf-8");
}

/**
 * 读取单章账本
 */
export async function loadLedger(
    rootDir: string,
    chapterNum: number
): Promise<ChapterLedger | null> {
    const filePath = path.join(getLedgerDir(rootDir), getLedgerFileName(chapterNum));
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return ChapterLedgerSchema.parse(parsed);
    } catch (error: any) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}

/**
 * 批量读取连续区间的账本
 */
export async function loadLedgerRange(
    rootDir: string,
    startChapter: number,
    endChapter: number
): Promise<ChapterLedger[]> {
    const ledgers: ChapterLedger[] = [];
    for (let ch = startChapter; ch <= endChapter; ch++) {
        const item = await loadLedger(rootDir, ch);
        if (item) {
            ledgers.push(item);
        }
    }
    return ledgers;
}

/**
 * 将多个账本压缩聚合为给 Planner 或写作 Agent 消费的高密度摘要文本
 */
export function formatLedgerSummaries(ledgers: ChapterLedger[]): string {
    if (ledgers.length === 0) {
        return "暂无章节账本数据。";
    }

    return ledgers
        .map((l) => {
            const charDetails = l.characters
                .map((c) =>
                    c.statusChange
                        ? `${c.name}(${c.action}, 状态:${c.statusChange})`
                        : `${c.name}(${c.action})`
                )
                .join("、");

            const lines = [
                `### 第 ${l.chapter} 章：《${l.title}》${l.narrativeBeat ? `【节拍: ${l.narrativeBeat}】` : ""}`,
                `- **核心剧情**：${l.summary}`,
                `- **登场人物**：${charDetails || "无明显角色"}`,
                `- **关联势力**：${l.factions.join("、") || "无"}`,
                `- **体系/宝物**：${l.systems.join("、") || "无"}`,
                `- **重大事件**：${l.significantEvents.join("；") || "无"}`,
                `- **伏笔线索**：${l.foreshadowing.join("；") || "无"}`,
            ];

            return lines.join("\n");
        })
        .join("\n\n");
}