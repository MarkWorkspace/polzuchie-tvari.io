import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Balance Console",
  description: "Polzuchie-tvari.io game administration console",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
