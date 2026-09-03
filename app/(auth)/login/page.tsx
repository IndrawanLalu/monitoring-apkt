import { LoginForm } from './login-form'

/**
 * Server component supaya formnya ikut ter-render di HTML.
 *
 * `searchParams` dibaca di sini, bukan dengan useSearchParams() di komponen
 * form: hook itu mewajibkan pembungkus <Suspense>, dan akibatnya seluruh form
 * login hilang dari HTML server — halaman terkirim kosong lalu berkedip saat
 * JavaScript selesai dimuat.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>
}) {
  const { err } = await searchParams
  return <LoginForm tanpaProfil={err === 'no-profile'} />
}
