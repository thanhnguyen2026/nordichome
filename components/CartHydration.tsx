'use client'
import { useEffect } from 'react'
import { useCartStore } from '@/store/cartStore'

export default function CartHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate()
    useCartStore.getState().setHasHydrated(true)
  }, [])
  return null
}