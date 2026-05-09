"use client";

import { Sparkles } from "lucide-react";

const isGhPagesDemo = process.env.NEXT_PUBLIC_GH_PAGES === "1";

export function DemoBanner() {
  if (!isGhPagesDemo) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--accent-2)] to-[var(--accent-3)] px-4 py-2 text-center text-sm font-medium text-slate-900">
      <Sparkles className="h-4 w-4 shrink-0" />
      <span>
        <strong>Interactive Demo</strong>
        {" · "}完成任务、解锁成就——演示数据随时还原，放心体验
        {" · "}
        <a
          href="https://github.com/GitGPT-jpg/jianghu-nightrain"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80"
        >
          View Source on GitHub →
        </a>
      </span>
    </div>
  );
}
