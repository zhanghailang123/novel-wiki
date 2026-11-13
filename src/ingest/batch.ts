// src/ingest/batch.ts
import { readChapter } from "../tools/sandbox.js";
import { extractChapterLedger } from "./extractor.js";
import { hasLedger, saveLedger } from "./storage.js";

export interface BatchIngestOptions {
    rootDir: string;
    startChapter: number;
    endChapter: number;
    concurrency?: number; // 并发请求数，默认 3
}

/**
 * 批量抽取指定章节区间的账本
 */
export async function batchIngestChapters(
    options: BatchIngestOptions
): Promise<{ total: number; processed: number; skipped: number; failed: number }> {
    const { rootDir, startChapter, endChapter, concurrency = 3 } = options;

    const total = endChapter - startChapter + 1;
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    console.log(`\n========================================`);
    console.log(`🚀 开始批量章节抽取 (第 ${startChapter} 章 ~ 第 ${endChapter} 章, 共 ${total} 章)`);
    console.log(`⚡ 当前并发池大小: ${concurrency}`);
    console.log(`========================================\n`);

    // 构造所有章节的任务列表
    const chaptersToProcess: number[] = [];
    for (let ch = startChapter; ch <= endChapter; ch++) {
        chaptersToProcess.push(ch);
    }

    // 并发池执行器
    let currentIndex = 0;

    async function worker(workerId: number): Promise<void> {
        while (currentIndex < chaptersToProcess.length) {
            const chapterNum = chaptersToProcess[currentIndex++];

            // 1. 断点跳过已存在的账本
            const alreadyExists = await hasLedger(rootDir, chapterNum);
            if (alreadyExists) {
                skipped++;
                console.log(`⏩ [Worker ${workerId}] 第 ${chapterNum} 章账本已存在，秒级跳过 (${skipped + processed}/${total})`);
                continue;
            }

            // 2. 读取原文正文
            let chapterText = "";
            try {
                chapterText = await readChapter(rootDir, chapterNum);
            } catch (err: any) {
                failed++;
                console.error(`❌ [Worker ${workerId}] 读取第 ${chapterNum} 章原著失败: ${err.message}`);
                continue;
            }

            // 3. 执行单章抽取并落盘
            const startTime = Date.now();
            try {
                console.log(`⏳ [Worker ${workerId}] 正在抽取第 ${chapterNum} 章...`);
                const ledger = await extractChapterLedger(chapterNum, chapterText);
                await saveLedger(rootDir, ledger);
                processed++;
                const costSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(
                    `✅ [Worker ${workerId}] 第 ${chapterNum} 章《${ledger.title}》抽取成功! 耗时 ${costSeconds}s (进度: ${skipped + processed}/${total})`
                );
            } catch (err: any) {
                failed++;
                console.error(`❌ [Worker ${workerId}] 第 ${chapterNum} 章抽取失败: ${err.message}`);
            }
        }
    }

    // 启动并发 worker 线程池
    const poolSize = Math.min(concurrency, chaptersToProcess.length);
    const workers = Array.from({ length: poolSize }, (_, i) => worker(i + 1));
    await Promise.all(workers);

    console.log(`\n========================================`);
    console.log(`🎉 批量抽取完毕！总计: ${total} 章 | 新增提取: ${processed} 章 | 断点跳过: ${skipped} 章 | 失败: ${failed} 章`);
    console.log(`📁 事实账本已妥善保存在 ledger/ 目录下！`);
    console.log(`========================================\n`);

    return { total, processed, skipped, failed };
}