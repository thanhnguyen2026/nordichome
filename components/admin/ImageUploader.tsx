'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'

interface Props {
  coverImage: string
  images: string[]
  onCoverChange: (url: string) => void
  onImagesChange: (urls: string[]) => void
}

export default function ImageUploader({ coverImage, images, onCoverChange, onImagesChange }: Props) {
  const coverRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url || null
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadFile(file)
    if (url) onCoverChange(url)
    setUploading(false)
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    const urls: string[] = []
    for (const file of files) {
      const url = await uploadFile(file)
      if (url) urls.push(url)
    }
    onImagesChange([...images, ...urls])
    setUploading(false)
  }

  const removeImage = (idx: number) => {
    onImagesChange(images.filter((_, i) => i !== idx))
  }

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onImagesChange(next)
  }

  return (
    <div className="space-y-4">
      {/* Cover image */}
      <div>
        <label className="text-xs font-semibold text-stone-500 block mb-2">Ảnh đại diện (ảnh chính)</label>
        <div className="flex gap-3 items-center">
          <div className="relative w-24 h-24 bg-stone-100 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden">
            {coverImage ? <Image src={coverImage} alt="Ảnh đại diện" fill sizes="96px" className="object-cover" /> : <span className="text-3xl">🛋️</span>}
          </div>
          <div>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading}
              className="bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-stone-200 transition disabled:opacity-50">
              📁 Chọn ảnh đại diện
            </button>
            {coverImage && (
              <button type="button" onClick={() => onCoverChange('')}
                className="ml-2 text-red-500 text-xs hover:underline">Xoá</button>
            )}
          </div>
        </div>
      </div>

      {/* Gallery images */}
      <div>
        <label className="text-xs font-semibold text-stone-500 block mb-2">Ảnh chi tiết (nhiều ảnh)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((img, i) => (
            <div key={i} className="relative w-20 h-20 bg-stone-100 rounded-lg overflow-hidden">
              <Image src={img} alt={`Ảnh chi tiết ${i + 1}`} fill sizes="80px" className="object-cover" />
              <button type="button" onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-sm">
                ✕
              </button>
              <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1">
                <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0}
                  className="bg-black/60 text-white rounded w-5 h-5 text-xs flex items-center justify-center disabled:opacity-30">
                  ‹
                </button>
                <button type="button" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}
                  className="bg-black/60 text-white rounded w-5 h-5 text-xs flex items-center justify-center disabled:opacity-30">
                  ›
                </button>
              </div>
            </div>
          ))}
        </div>
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
        <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading}
          className="bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-stone-200 transition disabled:opacity-50">
          {uploading ? '⏳ Đang upload...' : '📁 Thêm ảnh chi tiết'}
        </button>
      </div>
    </div>
  )
}