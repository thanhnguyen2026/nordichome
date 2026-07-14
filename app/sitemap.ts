import { supabase } from '@/lib/supabase'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: products }, { data: categories }, { data: looks }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('is_visible', true),
    supabase.from('categories').select('slug').eq('is_visible', true),
    supabase.from('looks').select('id, created_at').eq('is_active', true),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

  const productUrls = products?.map(p => ({
    url: `${siteUrl}/products/${p.slug}`,
    lastModified: new Date(p.updated_at),
  })) ?? []

  const categoryUrls = categories?.map(c => ({
    url: `${siteUrl}/products?category=${c.slug}`,
  })) ?? []

  const lookUrls = looks?.map(l => ({
    url: `${siteUrl}/looks/${l.id}`,
    lastModified: new Date(l.created_at),
  })) ?? []

  const policyUrls = [
    'chinh-sach-bao-mat',
    'chinh-sach-doi-tra',
    'dieu-khoan-su-dung',
  ].map(slug => ({ url: `${siteUrl}/${slug}` }))

  return [
    { url: siteUrl, lastModified: new Date() },
    { url: `${siteUrl}/products`, lastModified: new Date() },
    ...productUrls,
    ...categoryUrls,
    ...lookUrls,
    ...policyUrls,
  ]
}