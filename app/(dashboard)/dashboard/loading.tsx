export default function DashboardLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-neo-white">
      {/* Header skeleton */}
      <div className="shrink-0 h-16 border-b-2 border-neo-black flex items-center gap-4 px-4 animate-pulse" style={{ backgroundColor: '#003B8E' }}>
        <div className="h-6 w-48 rounded bg-white/20" />
        <div className="flex gap-3 ml-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 rounded bg-white/20" />
          ))}
        </div>
      </div>

      {/* Regu grid skeleton */}
      <div className="flex-1 grid grid-cols-4 overflow-hidden border-t-2 border-neo-black">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col border-r-2 border-neo-black last:border-r-0 animate-pulse">
            {/* Regu header */}
            <div className="h-10 border-b-2 border-neo-black bg-neo-gray/60 flex items-center px-3 gap-2">
              <div className="h-4 w-24 rounded bg-neo-gray-dark" />
              <div className="h-5 w-8 rounded bg-neo-gray-dark ml-auto" />
            </div>
            {/* Laporan items */}
            <div className="flex-1 p-3 flex flex-col gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="neo-border p-2 bg-neo-gray/30">
                  <div className="h-3 w-20 rounded bg-neo-gray-dark mb-2" />
                  <div className="h-3 w-32 rounded bg-neo-gray-dark mb-1" />
                  <div className="h-3 w-28 rounded bg-neo-gray-dark" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar skeleton */}
      <div className="shrink-0 h-11 border-t-2 border-neo-black bg-neo-gray flex items-center px-4 justify-between animate-pulse">
        <div className="h-3 w-32 rounded bg-neo-gray-dark" />
        <div className="flex gap-2">
          <div className="h-7 w-24 rounded bg-neo-gray-dark" />
          <div className="h-7 w-36 rounded bg-neo-gray-dark" />
        </div>
      </div>
    </div>
  )
}
