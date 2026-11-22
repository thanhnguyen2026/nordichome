#!/usr/bin/env node
// Đăng 1 sản phẩm lên Website (Supabase) và/hoặc Facebook Page từ một thư mục
// chứa ảnh + file nội dung <slug>.md (định dạng của skill
// nordic-product-campaign-generator).
//
// Dùng được cả trên máy Windows (đọc .env.local) lẫn phiên Claude trên đám mây
// (môi trường "nordichome": proxy tự chèn token Facebook vào graph.facebook.com
// và khoá Supabase vào header apikey — khi đó các biến khoá có thể để trống).
//
//   node scripts/publish-product.mjs <thư-mục> [--website] [--facebook]
//        [--price 890000] [--category <slug-danh-mục>] [--visible] [--dry-run]
//
// - Ảnh: mọi .png/.jpg/.jpeg/.webp trong <thư-mục> (hoặc <thư-mục>/images),
//   theo thứ tự tên file; ảnh đầu tiên là ảnh bìa.
// - Website: sản phẩm được tạo ở trạng thái ẨN trừ khi có cả --price và
//   --visible. Dòng mô tả còn "[Cần bổ sung]" bị bỏ khỏi bản đăng.
// - Facebook: đăng 1 bài nhiều ảnh lên Page; CTA trỏ tới trang sản phẩm nếu
//   website đã đăng (hoặc đăng trong cùng lần chạy).
// - Ghi kết quả vào <thư-mục>/status.json; không đăng lại nền tảng đã true
//   (thêm --force để đăng lại).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

// fetch() có sẵn của Node không tự đi qua HTTPS_PROXY (môi trường đám mây
// bắt buộc đi qua proxy) — chạy lại chính script với NODE_USE_ENV_PROXY=1.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  })
  process.exit(r.status ?? 1)
}

// ---------- cấu hình ----------
function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rdklbrtbxtatpwdjtgrl.supabase.co'
// Trên đám mây proxy ghi đè header — giá trị giả chỉ để header tồn tại.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'proxy-injected'
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '636095253689048'
const FB_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || 'proxy-injected'
const SITE = process.env.SITE_URL || 'https://nordichome.vercel.app'
const GRAPH = 'https://graph.facebook.com/v19.0'

const args = process.argv.slice(2)
const dir = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a) && args[args.indexOf(a) - 1] !== '--category')
const flag = n => args.includes(`--${n}`)
const opt = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined }
if (!dir || !fs.existsSync(dir)) {
  console.error('Thiếu hoặc sai thư mục sản phẩm.'); process.exit(1)
}
const doWebsite = flag('website') || !flag('facebook')
const doFacebook = flag('facebook') || !flag('website')
const DRY = flag('dry-run')
const FORCE = flag('force')

// ---------- đọc nội dung ----------
const mdFile = fs.readdirSync(dir).find(f => f.endsWith('.md'))
if (!mdFile) { console.error('Không thấy file .md nội dung trong thư mục.'); process.exit(1) }
const md = fs.readFileSync(path.join(dir, mdFile), 'utf8')

// Trả về nội dung của heading "## name" nằm trong khối "# block"
function section(block, name) {
  const b = md.split(/^# /m).find(s => s.startsWith(block + '\n'))
  if (!b) return ''
  const parts = b.split(/^## /m)
  const s = parts.find(p => p.startsWith(name + '\n'))
  return s ? s.slice(name.length + 1).replace(/\n---\s*$/, '').trim() : ''
}
const stripTodo = t => t.split('\n').filter(l => !l.includes('[Cần bổ sung]')).join('\n').replace(/\n{3,}/g, '\n\n').trim()

const slug = section('Product', 'Slug') || path.basename(mdFile, '.md')
const name = section('Product', 'Product Name')

const imgDir = fs.existsSync(path.join(dir, 'images')) ? path.join(dir, 'images') : dir
const images = fs.readdirSync(imgDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort().map(f => path.join(imgDir, f))
if (!images.length) { console.error('Không có ảnh.'); process.exit(1) }

const statusPath = path.join(dir, 'status.json')
const status = fs.existsSync(statusPath) ? JSON.parse(fs.readFileSync(statusPath, 'utf8')) : {
  website: false, facebook: false, tiktok: false, shopee: false,
  website_url: '', facebook_post_url: '', facebook_post_id: '', tiktok_url: '', tiktok_video_id: '',
  shopee_url: '', shopee_item_id: '', published_at: { website: '', facebook: '', tiktok: '', shopee: '' }, last_updated: '',
}
const saveStatus = () => { status.last_updated = new Date().toISOString(); if (!DRY) fs.writeFileSync(statusPath, JSON.stringify(status, null, 2)) }

async function retry(fn, label) {
  for (let i = 1; ; i++) {
    try { return await fn() } catch (e) {
      if (i >= 3 || e.fatal) throw e
      console.warn(`  ${label}: lỗi tạm thời (${e.message}), thử lại lần ${i + 1}...`)
      await new Promise(r => setTimeout(r, 2000 * i))
    }
  }
}
async function http(url, init, label) {
  return retry(async () => {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) })
    const text = await res.text()
    let body; try { body = JSON.parse(text) } catch { body = text }
    if (!res.ok) {
      const err = new Error(`${label} ${res.status}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body)}`)
      err.fatal = res.status < 500
      throw err
    }
    return body
  }, label)
}

// ---------- Website ----------
// apikey = khoá anon công khai (cổng API chỉ cần nó để nhận diện dự án);
// quyền thật đến từ khoá service_role trong Authorization (trên đám mây do
// proxy chèn vào, trên máy đọc từ .env.local).
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_KEY
const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_KEY}` }

async function publishWebsite() {
  if (status.website && !FORCE) { console.log('Website: đã đăng trước đó, bỏ qua.'); return }
  const existing = await http(`${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&select=id`, { headers: sbHeaders }, 'Kiểm tra slug')
  if (existing.length && !FORCE) throw Object.assign(new Error(`slug "${slug}" đã tồn tại trên website`), { fatal: true })

  const catSlug = opt('category')
  let category_id = null
  if (catSlug) {
    const c = await http(`${SUPABASE_URL}/rest/v1/categories?slug=eq.${encodeURIComponent(catSlug)}&select=id`, { headers: sbHeaders }, 'Danh mục')
    if (!c.length) throw Object.assign(new Error(`không có danh mục ${catSlug}`), { fatal: true })
    category_id = c[0].id
  }

  const urls = []
  for (const [i, f] of images.entries()) {
    const buf = await sharp(f).rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    const key = `${Date.now()}-${slug}-${String(i + 1).padStart(2, '0')}.jpg`
    if (DRY) { urls.push(`(dry) ${key}`); continue }
    await http(`${SUPABASE_URL}/storage/v1/object/images/${key}`, {
      method: 'POST', headers: { ...sbHeaders, 'Content-Type': 'image/jpeg' }, body: buf,
    }, `Upload ảnh ${i + 1}`)
    urls.push(`${SUPABASE_URL}/storage/v1/object/public/images/${key}`)
    console.log(`  Ảnh ${i + 1}/${images.length} đã tải lên`)
  }

  const price = opt('price') ? Number(opt('price')) : 0
  const row = {
    name, slug, sku: '', category_id,
    price, sale_price: null,
    short_desc: stripTodo(section('WEBSITE', 'Short Description')),
    description: stripTodo(section('WEBSITE', 'Long Description')),
    // "## Specs" dạng "- Nhãn: Giá trị" → bảng thông số; bỏ dòng còn [Cần bổ sung]
    specs: section('WEBSITE', 'Specs').split('\n')
      .map(l => l.replace(/^\s*[-•]\s*/, '').trim())
      .filter(l => l.includes(':') && !l.includes('[Cần bổ sung]'))
      .map(l => { const i = l.indexOf(':'); return { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } }),
    // "## Content Blocks" dạng "- 02: Chú thích" (số = thứ tự ảnh) → khối ảnh
    // lớn kèm chú thích trên trang sản phẩm. Không có mục này → mọi ảnh trừ
    // ảnh bìa, không chú thích.
    content_blocks: (() => {
      const lines = section('WEBSITE', 'Content Blocks').split('\n')
        .map(l => l.match(/^\s*[-•]\s*(\d+)\s*:?\s*(.*)$/)).filter(Boolean)
      const pick = lines.length
        ? lines.map(m => ({ i: Number(m[1]) - 1, text: m[2].trim() }))
        : urls.slice(1).map((_, k) => ({ i: k + 1, text: '' }))
      return pick.filter(b => urls[b.i]).map(b => ({ text: b.text, image_url: urls[b.i] }))
    })(),
    cover_image: urls[0], images: urls,
    weight: 0.5, in_stock: true, is_preorder: false,
    is_visible: Boolean(flag('visible') && price > 0),
    is_featured: false, is_new: true, is_bulky: false,
    meta_title: section('SEO', 'Meta Title'),
    meta_description: section('SEO', 'Meta Description'),
  }
  if (DRY) { console.log('Website (dry-run):', JSON.stringify({ ...row, description: row.description.slice(0, 80) + '...' }, null, 2)); return }
  const [created] = await http(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST', headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  }, 'Tạo sản phẩm')
  status.website = true
  status.website_url = `${SITE}/products/${created.slug}`
  status.website_visible = created.is_visible
  status.published_at.website = new Date().toISOString()
  saveStatus()
  console.log(`Website: ĐÃ TẠO ${row.is_visible ? '(đang hiển thị)' : '(đang ẨN — cần nhập giá và bật hiển thị)'} → ${status.website_url}`)
}

// ---------- Facebook ----------
const fbHeaders = { Authorization: `Bearer ${FB_TOKEN}` }

async function publishFacebook() {
  if (status.facebook && !FORCE) { console.log('Facebook: đã đăng trước đó, bỏ qua.'); return }
  // Sản phẩm còn ẩn trên web → link sẽ 404, dùng CTA mặc định (trang chủ).
  const cta = status.website_url && status.website_visible ? `👉 Xem thêm: ${status.website_url}` : section('FACEBOOK', 'CTA')
  const message = [section('FACEBOOK', 'Title'), section('FACEBOOK', 'Content'), cta, section('FACEBOOK', 'Hashtags')]
    .filter(Boolean).join('\n\n')
  if (message.includes('[Cần bổ sung]')) throw Object.assign(new Error('nội dung Facebook còn [Cần bổ sung]'), { fatal: true })
  if (DRY) { console.log('Facebook (dry-run):\n' + message); return }

  const mediaIds = []
  for (const [i, f] of images.entries()) {
    const buf = await sharp(f).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
    const form = new FormData()
    form.append('published', 'false')
    form.append('source', new Blob([buf], { type: 'image/jpeg' }), `${i + 1}.jpg`)
    const r = await http(`${GRAPH}/${FB_PAGE_ID}/photos`, { method: 'POST', headers: fbHeaders, body: form }, `FB ảnh ${i + 1}`)
    mediaIds.push(r.id)
    console.log(`  FB ảnh ${i + 1}/${images.length} đã tải lên`)
  }
  const form = new URLSearchParams({ message })
  mediaIds.forEach((id, i) => form.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })))
  const post = await http(`${GRAPH}/${FB_PAGE_ID}/feed`, { method: 'POST', headers: fbHeaders, body: form }, 'FB đăng bài')
  const [pageId, postId] = post.id.split('_')
  status.facebook = true
  status.facebook_post_id = post.id
  status.facebook_post_url = `https://www.facebook.com/${pageId}/posts/${postId}`
  status.published_at.facebook = new Date().toISOString()
  saveStatus()
  console.log(`Facebook: ĐÃ ĐĂNG → ${status.facebook_post_url}`)
}

// ---------- chạy ----------
console.log(`Sản phẩm: ${name} (${slug}) — ${images.length} ảnh`)
let failed = false
if (doWebsite) { try { await publishWebsite() } catch (e) { failed = true; console.error('Website: LỖI —', e.message) } }
if (doFacebook) { try { await publishFacebook() } catch (e) { failed = true; console.error('Facebook: LỖI —', e.message) } }
process.exit(failed ? 1 : 0)
