import type { Metadata } from "next";
import NoraApp from "@/components/nora-app";

export const metadata: Metadata = { title: "Nora Flow · 家长端" };
export default function ParentPage() {
  return <NoraApp parentMode />;
}
