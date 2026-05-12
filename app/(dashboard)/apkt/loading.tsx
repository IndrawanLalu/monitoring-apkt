export default function ApktLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-pln-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-neo-black">Memuat Monitor APKT...</p>
      </div>
    </div>
  )
}
