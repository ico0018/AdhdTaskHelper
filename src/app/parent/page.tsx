import type { Metadata } from "next";
import NoraApp from "@/components/nora-app";

export const metadata: Metadata = { title: "任务小帮手 · 家长端" };
export default function ParentPage() {
  return <NoraApp parentMode />;
}

