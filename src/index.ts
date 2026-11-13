import { runPlannerAgent } from "./planner/planner.js";
import { createInitialState, getNextPendingState, loadRunState, resetIncompletePages, saveRunState, updatePageStatus } from "./state.js";
import { runPageWorkerAgent } from "./worker/worker.js";

async function main() {
    const rootDir = process.cwd();

    //1. 加载或初始化状态机
    let state = await loadRunState(rootDir);
    if (!state) {
        console.log("初始化全新的《赤心巡天》任务状态....");
        state = createInitialState("chixin-xuntian", "v1.0.0");
        await saveRunState(rootDir, state);
    }

    //2. 阶段一：全书词条规划
    if (state.phase === "planning") {
        console.log("\n📍 [阶段 1/2] 启动 Planner Agent 规划全书词条...")
        await runPlannerAgent(rootDir, state, 10);
    } else {
        console.log("\n⚡ [阶段 1/2] 规划蓝图已就绪，跳过 Planner！");
    }


    //3. 阶段二：外层队列循环，逐页派发给隔离Worker
    if (state.phase == "generating") {
        const resetCount = resetIncompletePages(state);
        if (resetCount > 0) {
            console.log(`♻️ 检测到 ${resetCount} 个上次中断或跳过的词条，已重新放回待处理队列！`);
            await saveRunState(rootDir, state);
        }
        console.log("\n📍 [阶段 2/2] 进入单页词条生成队列 (One Fresh Agent Per Page)...");

        while (true) {
            const nextJob = getNextPendingState(state);
            if (!nextJob) {
                // 只有全部都 completed（没有 skipped），才能真正终结！
                const hasSkipped = state.plan?.pages.some((p) => p.status === "skipped");
                if (hasSkipped) {
                    console.log("\n⚠️ 队列本轮已跑完，但仍有部分词条被跳过！下次运行 pnpm dev 将自动重试它们。");
                } else {
                    console.log("\n🎉 所有词条页面已全部生成完毕！");
                    state.phase = "finalized";
                    await saveRunState(rootDir, state);
                }
                break;
            }

            console.log(`\n========================================`);
            console.log(`🎯 认领作业: [${nextJob.title}] -> ${nextJob.path}`);

            updatePageStatus(state, nextJob.id, "running");
            await saveRunState(rootDir, state);

            try {
                await runPageWorkerAgent(rootDir, nextJob);
                updatePageStatus(state, nextJob.id, "completed");
                await saveRunState(rootDir, state);
            } catch (err: any) {
                console.error(`❌ 词条 [${nextJob.title}] 生成失败:`, err.message);
                await saveRunState(rootDir, state);
                console.log(`⚠️ 已安全跳过 [${nextJob.title}]，继续推进下一个任务...`);
            }
        }
    } else if (state.phase === "finalized") {
        console.log("\n✨ 本次任务早已全部完成 (finalized)。如需重新生成，请删除 .novel-run.json！");
    }

    console.log("\n🏁 NovelWiki 运行结束！请打开 wiki/ 目录验收成果！");
}

main().catch((err) => {
    console.error("❌ 致命异常:", err);
});