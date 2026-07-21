import { Sk } from "@/components/Skeletons";

// The dashboard layout (header + sidebar) stays mounted during navigation
// between dashboard sub-pages, so this only fills the content column.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Sk className="h-7 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="space-y-3 rounded-md border border-border bg-white p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
