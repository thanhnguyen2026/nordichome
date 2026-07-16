'use client'
import { useCallback, useRef, useState } from 'react'

interface PromptState {
  message: string
  defaultValue: string
  type: 'text' | 'number'
}

// Thay cho window.prompt() — cùng lý do với useConfirm.tsx: Safari trên
// iPhone có thể chặn hộp thoại JS gốc theo từng trang, khiến các thao tác
// dùng prompt() (đổi giá %, cộng/trừ kho, lý do huỷ đơn...) im lặng không
// phản hồi sau đó. Modal tự vẽ không bị chặn kiểu này.
export function usePrompt() {
  const [state, setState] = useState<PromptState | null>(null)
  const [value, setValue] = useState('')
  const resolver = useRef<((v: string | null) => void) | null>(null)

  const promptValue = useCallback((message: string, opts?: { defaultValue?: string; type?: 'text' | 'number' }) => {
    setState({ message, defaultValue: opts?.defaultValue ?? '', type: opts?.type ?? 'text' })
    setValue(opts?.defaultValue ?? '')
    return new Promise<string | null>(resolve => { resolver.current = resolve })
  }, [])

  const handleCancel = () => {
    setState(null)
    resolver.current?.(null)
    resolver.current = null
  }

  const handleConfirm = () => {
    const v = value
    setState(null)
    resolver.current?.(v)
    resolver.current = null
  }

  const PromptDialog = state && (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={handleCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-stone-700 mb-3 whitespace-pre-line">{state.message}</p>
        <input
          autoFocus
          type={state.type}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 mb-5"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={handleCancel}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 transition cursor-pointer">
            Huỷ
          </button>
          <button onClick={handleConfirm}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer">
            OK
          </button>
        </div>
      </div>
    </div>
  )

  return { promptValue, PromptDialog }
}
