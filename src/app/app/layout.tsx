import { AppShell } from "@/components/layout/app-shell";

export default function OfficeLayout({ children }: LayoutProps<"/app">) {
  return <AppShell>{children}</AppShell>;
}
