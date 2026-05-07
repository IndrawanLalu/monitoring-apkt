export default function SettingsLoading() {
  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-4 animate-pulse">
      {/* Title */}
      <div className="h-7 w-40 rounded bg-neo-gray" />

      {/* Cards */}
      {[180, 240, 300, 200].map((h, i) => (
        <div key={i} className="neo-border bg-neo-white p-4 flex flex-col gap-3">
          {/* Card header */}
          <div className="h-5 w-36 rounded bg-neo-gray" />
          <div className="h-px bg-neo-gray" />
          {/* Card content lines */}
          <div className="flex flex-col gap-2" style={{ height: h - 80 }}>
            {Array.from({ length: Math.floor((h - 80) / 32) }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-9 flex-1 rounded neo-border bg-neo-gray" />
                {j === 0 && <div className="h-9 w-24 rounded neo-border bg-neo-gray" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
