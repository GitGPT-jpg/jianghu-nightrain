import type { Metadata } from "next";

import { SystemMini } from "@/components/system-mini";

export const metadata: Metadata = {
  title: "系统页 | 江湖夜雨十年灯",
};

export default function SystemPage() {
  return <SystemMini />;
}
