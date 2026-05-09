import { NextResponse } from "next/server";

import { sanitizeGoalPlan } from "@/lib/goal-plan";

const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiBaseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const openAiModel = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

function extractMessageText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item) {
          const text = item.text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("\n");
  }

  return "";
}

function extractJsonText(rawText: string) {
  const fenced = rawText.match(/```json\s*([\s\S]*?)```/i) ?? rawText.match(/```\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return rawText.slice(start, end + 1);
  }

  throw new Error("模型没有返回可解析的 JSON。");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      goal?: string;
      deadline?: string;
      reward?: string;
    };

    const goal = body.goal?.trim();
    const deadline = body.deadline?.trim();
    const reward = body.reward?.trim() ?? "";

    if (!goal || !deadline) {
      return NextResponse.json({ error: "请先填写目标和完成时间。" }, { status: 400 });
    }

    if (!openAiApiKey) {
      return NextResponse.json(
        { error: "还没有配置 OPENAI_API_KEY，暂时无法生成 AI 规划。" },
        { status: 503 },
      );
    }

    const prompt = [
      "请根据用户目标生成一个系统流自我提升计划。",
      "返回纯 JSON，不要加 markdown，不要解释。",
      "字段必须严格包含：goalName, category, summary, currentPhaseIndex, currentPhasePercent, phases, longTasks, smallTasks。",
      "phases 是 3 到 5 个阶段，字段为 name, description, rewardText, rewardCoin。",
      "longTasks 是 3 到 6 个长期任务，适合周维度推进。",
      "smallTasks 是 6 到 10 个小任务，适合日维度执行。",
      "任务字段必须为 title, detail, difficulty, recurrence, phaseIndex, progressDelta, dueOffsetDays。",
      "difficulty 只能是 easy、normal、challenge。",
      "recurrence 只能是 none、daily、weekly。",
      "phaseIndex 从 0 开始。",
      "currentPhaseIndex 表示用户当前所处阶段。",
      "currentPhasePercent 表示当前阶段的完成百分比。",
      "内容要使用简体中文，语气务实，不要玄幻化。",
      `今天是 ${new Date().toISOString().slice(0, 10)}。`,
      `用户目标：${goal}`,
      `完成时间：${deadline}`,
      `完成奖励：${reward || "未填写"}`,
    ].join("\n");

    const response = await fetch(`${openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "你是一个帮助用户拆解长期目标的中文规划助手。你只返回结构化 JSON，不额外解释。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `模型接口调用失败：${errorText.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    };

    const rawContent = extractMessageText(data.choices?.[0]?.message?.content);
    const plan = sanitizeGoalPlan(JSON.parse(extractJsonText(rawContent)), goal);

    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "AI 规划生成失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}
