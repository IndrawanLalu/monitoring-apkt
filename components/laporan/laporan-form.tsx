'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { createLaporanSchema, type CreateLaporanInput } from '@/lib/validations/laporan'
import type { Regu } from '@/types'

interface LaporanFormProps {
  reguList: Regu[]
  defaultReguId?: string
  onSubmit: (data: CreateLaporanInput) => Promise<{ error?: string }>
  onCancel: () => void
}

export function LaporanForm({ reguList, defaultReguId, onSubmit, onCancel }: LaporanFormProps) {
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateLaporanInput, string>>>({})

  const [values, setValues] = useState<CreateLaporanInput>({
    nomor_tiket: '',
    regu_id: defaultReguId ?? '',
    nama_pelanggan: '',
    nomor_pelanggan: '',
    lokasi: '',
    keterangan: '',
  })

  function set<K extends keyof CreateLaporanInput>(key: K, value: CreateLaporanInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const result = createLaporanSchema.safeParse(values)
    if (!result.success) {
      const errors: Partial<Record<keyof CreateLaporanInput, string>> = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof CreateLaporanInput
        errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    const { error } = await onSubmit(result.data)
    if (error) {
      setServerError(error)
      setLoading(false)
      return
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input
            label="Nomor Tiket *"
            placeholder="G441550xxx"
            value={values.nomor_tiket}
            onChange={(e) => set('nomor_tiket', e.target.value)}
            error={fieldErrors.nomor_tiket}
          />
        </div>

        <div className="col-span-2">
          <Select
            label="Regu *"
            value={values.regu_id}
            onChange={(e) => set('regu_id', e.target.value)}
            error={fieldErrors.regu_id}
          >
            <option value="">Pilih regu...</option>
            {reguList.map((regu) => (
              <option key={regu.id} value={regu.id}>
                {regu.nama}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2">
          <Input
            label="Nama Pelanggan *"
            placeholder="Budi Santoso"
            value={values.nama_pelanggan}
            onChange={(e) => set('nama_pelanggan', e.target.value)}
            error={fieldErrors.nama_pelanggan}
          />
        </div>

        <div className="col-span-2">
          <Input
            label="Nomor Pelanggan"
            placeholder="081234567890"
            value={values.nomor_pelanggan ?? ''}
            onChange={(e) => set('nomor_pelanggan', e.target.value || null)}
            error={fieldErrors.nomor_pelanggan}
          />
        </div>

        <div className="col-span-2">
          <Input
            label="Lokasi *"
            placeholder="Jl. Merdeka No. 10"
            value={values.lokasi}
            onChange={(e) => set('lokasi', e.target.value)}
            error={fieldErrors.lokasi}
          />
        </div>

        <div className="col-span-2">
          <Textarea
            label="Keterangan"
            placeholder="Keterangan tambahan..."
            rows={3}
            value={values.keterangan ?? ''}
            onChange={(e) => set('keterangan', e.target.value || null)}
            error={fieldErrors.keterangan}
          />
        </div>
      </div>

      {serverError && (
        <div className="neo-border p-3 border-pln-red!" style={{ backgroundColor: '#FFF5F5' }}>
          <p className="text-sm font-medium text-pln-red">{serverError}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" size="md" className="flex-1" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" variant="primary" size="md" className="flex-1" loading={loading}>
          Simpan & Kirim WA
        </Button>
      </div>
    </form>
  )
}
