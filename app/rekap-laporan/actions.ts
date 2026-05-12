'use server'

import { cookies } from 'next/headers'

export async function checkPassword(formData: FormData) {
  const password = formData.get('password') as string
  if (password === 'KITABISA') {
    (await cookies()).set('rekap_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    return { success: true }
  }
  return { success: false, error: 'Sandi salah. Coba lagi.' }
}

export async function logoutRekap() {
  (await cookies()).delete('rekap_auth')
}
