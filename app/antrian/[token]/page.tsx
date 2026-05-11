import { AntrinanClient, type AntrianData } from './antrian-client'

export default async function AntrinanPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let initialData: AntrianData = { found: false }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/antrian/${token}`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      initialData = (await res.json()) as AntrianData
    }
  } catch {
    // fallback: client akan retry otomatis
  }

  return <AntrinanClient token={token} initialData={initialData} />
}
