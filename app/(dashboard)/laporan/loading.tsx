export default function LaporanLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="shrink-0 p-4 border-b-2 border-neo-black bg-neo-white animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-7 w-48 rounded bg-neo-gray" />
          <div className="h-8 w-28 rounded bg-neo-gray" />
        </div>
        {/* Quick stats */}
        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-20 rounded neo-border bg-neo-gray" />
          ))}
        </div>
        {/* Filters */}
        <div className="flex gap-2">
          <div className="h-9 flex-1 rounded neo-border bg-neo-gray" />
          <div className="h-9 w-32 rounded neo-border bg-neo-gray" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="flex-1 overflow-hidden">
        {/* Table header */}
        <div className="h-9 bg-neo-black flex items-center px-3 gap-6">
          {[80, 100, 120, 80, 80, 60].map((w, i) => (
            <div key={i} className="h-3 rounded bg-white/20" style={{ width: w }} />
          ))}
        </div>
        {/* Table rows */}
        <div className="divide-y divide-neo-gray animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center px-3 gap-6 h-14">
              <div className="h-3 w-20 rounded bg-neo-gray" />
              <div className="flex flex-col gap-1">
                <div className="h-3 w-28 rounded bg-neo-gray" />
                <div className="h-2 w-20 rounded bg-neo-gray/60" />
              </div>
              <div className="h-3 w-32 rounded bg-neo-gray hidden md:block" />
              <div className="h-3 w-16 rounded bg-neo-gray hidden lg:block" />
              <div className="h-5 w-20 rounded bg-neo-gray" />
              <div className="h-3 w-24 rounded bg-neo-gray hidden xl:block" />
              <div className="h-3 w-20 rounded bg-neo-gray hidden lg:block" />
              <div className="flex gap-1 ml-auto">
                <div className="h-7 w-16 rounded neo-border bg-neo-gray" />
                <div className="h-7 w-16 rounded neo-border bg-neo-gray" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="shrink-0 px-4 py-2 border-t-2 border-neo-black bg-neo-gray animate-pulse">
        <div className="h-3 w-40 rounded bg-neo-gray-dark" />
      </div>
    </div>
  )
}
