// scripts/run-ingest.ts
import { batchIngestChapters } from "../src/ingest/batch.js";

async function main() {
    const rootDir = process.cwd();

    // 默认测试前 5 章（您可以根据需要调整为 1~10 或更多）
    const start = 1;
    const end = 20;

    await batchIngestChapters({
        rootDir,
        startChapter: start,
        endChapter: end,
        concurrency: 2, // 初始使用 2 并发，平稳避免 429
    });
}

main().catch((err) => {
    console.error("❌ 批处理运行异常:", err);
});