'use client'
import { useCallback, useRef, useState } from 'react'

interface ConfirmState {
  message: string
  danger?: boolean
  confirmLabel?: string
}

// Thay cho window.confirm() — Safari trên iPhone cho phép người dùng bấm
// "Hộp thoại loại bỏ" để chặn vĩnh viễn mọi confirm()/prompt() từ trang đó,
// khiến các nút xoá/huỷ đơn im lặng không phản hồi sau đó mà không báo lỗi
// gì. Modal tự vẽ không bị trình duyệt chặn kiểu này.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, opts?: { danger?: boolean; confirmLabel?: string }) => {
    setState({ message, danger: opts?.danger, confirmLabel: opts?.confirmLabel })
    return new Promise<boolean>(resolve => { resolver.current = resolve })
  }, [])

  const handle = (result: boolean) => {
    setState(null)
    resolver.current?.(result)
    resolver.current = null
  }

  const ConfirmDialog = state && (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => handle(false)}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-stone-700 mb-5 whitespace-pre-line">{state.message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => handle(false)}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 transition cursor-pointer">
            Huỷ
          </button>
          <button onClick={() => handle(true)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg text-white transition cursor-pointer ${
              state.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-stone-900 hover:bg-stone-800'
            }`}>
            {state.confirmLabel || (state.danger ? 'Xoá' : 'Đồng ý')}
          </button>
        </div>
      </div>
    </div>
  )

  return { confirm, ConfirmDialog }
}
