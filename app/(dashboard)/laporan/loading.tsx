export default function LaporanLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="shrink-0 p-4 border-b-2 border-neo-black bg-neo-white space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-6 w-44 rounded bg-neo-gray" />
            <div className="h-3 w-28 rounded bg-neo-gray/60" />
          </div>
          <div className="h-9 w-36 rounded neo-border bg-neo-gray" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-44 rounded neo-border bg-neo-gray" />
          <div className="h-9 w-36 rounded neo-border bg-neo-gray" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 w-16 rounded neo-border bg-neo-gray" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 animate-pulse">
        {/* Per Regu */}
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-neo-gray" />
          <div className="border-2 border-neo-black">
            <div className="h-9 bg-neo-black" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-6 px-3 h-10 border-t border-neo-gray">
                <div className="h-3 w-16 rounded bg-neo-gray" />
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-7 w-7 rounded bg-neo-gray mx-auto" />
                ))}
                <div className="h-3 w-8 rounded bg-neo-gray ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Per Piket */}
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-neo-gray" />
          {[1, 2].map((i) => (
            <div key={i} className="border-2 border-neo-black">
              <div className="h-9 bg-neo-gray/60 border-b-2 border-neo-black" />
              {[1, 2].map((j) => (
                <div key={j} className="flex items-center gap-6 px-3 h-10 border-t border-neo-gray">
                  <div className="h-3 w-16 rounded bg-neo-gray" />
                  {[1, 2, 3, 4].map((k) => (
                    <div key={k} className="h-6 w-6 rounded bg-neo-gray mx-auto" />
                  ))}
                  <div className="h-3 w-8 rounded bg-neo-gray ml-auto" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
