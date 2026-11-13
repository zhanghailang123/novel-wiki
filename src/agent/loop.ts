import { client, modelName } from "../config.js";
import { AgentLoopOptions, AgentTool } from "./types.js";

export async function runAgentLoop(options: AgentLoopOptions) {
    const { agentName, systemPrompt, userPrompt, tools, maxTurns = 15 } = options;

    console.log(`[${agentName}] 启动通用Agent Loop，载入工具：【${tools.map((t) => t.name).join(",")}】`);

    //1. 构建工具映射表和 OpenAI 工具定义列表

    const toolMap = new Map<string, AgentTool>(tools.map((t) => [t.name, t]));

    const openAiTools = tools.map((t) => (
        {
            type: "function" as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }
    ));

    //2. 初始化对话历史
    const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    let turn = 0;
    let isTerminated = false;

    //3. 通用循环
    while (!isTerminated && turn < maxTurns) {
        turn++;
        console.log(`【${agentName}】(轮次${turn}/${maxTurns} 正在思考下一步....)`);

        const response = await client.chat.completions.create({
            model: modelName,
            messages,
            tools: openAiTools,
            tool_choice: "required",// 👈 允许模型自己决定“说话”还是“调工具”
        });

        const message = response.choices[0].message;
        messages.push(message);

        //这里居然不是结束逻辑，强制模型去选择工具啊！！！！！
        if (!message.tool_calls || message.tool_calls.length === 0) {
            console.log(`[${agentName}] 模型输出普通文本：${message.content?.slice(0, 80)}...`);
            // 针对模型把 tool_call 当普通文本吐出的精准纠偏
            const isFakeToolCall = message.content?.includes("tool_call") || message.content?.includes("write_wiki_page");
            const nudgeMessage = isFakeToolCall
                ? "【系统拦截】检测到你把 tool_call 代码块输出到了普通文本里（这很可能是因为长文本 JSON 转义失败导致未触发函数调用）！工具并未真正执行！请不要输出 ```tool_call 文本，务必通过原生 Function Calling 调用工具，并确保参数是合法的 JSON（注意换行符用 \\n 转义）。"
                : "【系统提示】请不要只输出文字陈述！请立即调用相应工具推进或完成任务！";
            messages.push({
                role: "user",
                content: nudgeMessage,
            });
            continue;
        }

        // 统一分发并执行工具调用

        for (const toolCall of message.tool_calls) {
            if (toolCall.type !== "function") continue;

            const fnName = toolCall.function.name;
            const argsRaw = toolCall.function.arguments;

            // 👉 1. 打印模型实际生成的原始参数（前 200 字，或者全文）
            console.log(`[${agentName}] 触发工具：[${fnName}]`);
            console.log(`🔍 [${agentName}] 模型传入参数:`, argsRaw.length > 300 ? argsRaw.slice(0, 300) + "...(截断)" : argsRaw);

            const tool = toolMap.get(fnName);

            if (!tool) {
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `未找到工具【${fnName}】, 可用工具列表${Array.from(toolMap.keys()).join(",")}`
                });

                continue;
            }
            try {

                const rawArgs = JSON.parse(argsRaw);
                const validatedArgs = tool.schema.parse(rawArgs);

                const output = await tool.execute(validatedArgs);

                messages.push({
                    role: "tool",
                    content: output,
                    tool_call_id: toolCall.id,
                })

                //如果调用的是终结工具，标记完成准备退出循环
                if (tool.isTerminator) {
                    console.log(`【${agentName}】,终结工具[${fnName}] 成功执行，任务达成`);
                    isTerminated = true;
                }
            } catch (err: any) {
                // 👉 2. 异常时把完整的原始入参打印出来，方便一眼看出是哪个字段传歪了
                console.warn(`❌ [${agentName}] 执行工具 ${fnName} 异常:`, err.message);
                console.warn(`⚠️ [${agentName}] 异常时完整原始参数:`, argsRaw);

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `[工具执行或参数校验失败]：${err.message}, 请仔细检查参数后重试！`
                });
            }

        }

    }

    if (!isTerminated && turn >= maxTurns) {
        throw new Error(`[${agentName}] 达到最大轮次限制（${maxTurns}），仍然未完成任务！`);
    }
}