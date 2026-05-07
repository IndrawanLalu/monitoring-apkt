export default function PiketLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="shrink-0 p-4 border-b-2 border-neo-black bg-neo-white animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 rounded bg-neo-gray" />
          <div className="h-8 w-36 rounded bg-neo-gray" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="neo-border p-4 bg-neo-white flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="h-5 w-32 rounded bg-neo-gray" />
              <div className="h-3 w-48 rounded bg-neo-gray/60" />
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded bg-neo-gray" />
              <div className="h-7 w-16 rounded neo-border bg-neo-gray" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
