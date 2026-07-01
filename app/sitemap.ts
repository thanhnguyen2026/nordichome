import { supabase } from '@/lib/supabase'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: products } = await supabase.from('products')
    .select('slug, updated_at').eq('is_visible', true)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

  const productUrls = products?.map(p => ({
    url: `${siteUrl}/products/${p.slug}`,
    lastModified: new Date(p.updated_at),
  })) ?? []

  return [
    { url: siteUrl, lastModified: new Date() },
    { url: `${siteUrl}/products`, lastModified: new Date() },
    ...productUrls,
  ]
}