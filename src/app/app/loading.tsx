import { LoadingBlock } from "@/components/ui";

// Também é o shell que o Next prefetcha para navegação offline (experimental.useOffline).
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 h-9 w-56 animate-pulse rounded bg-surface-muted" />
      <LoadingBlock rows={5} />
    </div>
  );
}
