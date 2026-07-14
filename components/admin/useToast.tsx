'use client'
import { useCallback, useRef, useState } from 'react'

interface ToastState {
  message: string
  variant: 'error' | 'success' | 'info'
}

// Thay cho window.alert() — cùng lý do với useConfirm/usePrompt: Safari trên
// iPhone có thể chặn hộp thoại JS gốc theo từng trang sau khi người dùng bấm
// "Hộp thoại loại bỏ", khiến các thông báo lỗi/thành công im lặng biến mất.
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, opts?: { variant?: 'error' | 'success' | 'info' }) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ message, variant: opts?.variant ?? 'error' })
    timer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const Toast = toast && (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white max-w-[90vw] text-center cursor-pointer ${
        toast.variant === 'success' ? 'bg-green-600' : toast.variant === 'info' ? 'bg-stone-900' : 'bg-red-500'
      }`}
      onClick={() => setToast(null)}
    >
      {toast.message}
    </div>
  )

  return { showToast, Toast }
}
