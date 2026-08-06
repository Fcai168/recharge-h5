// 此文件已废弃，前端直接使用 js/supabase.js 调用 Supabase REST API
// 保留空导出避免构建错误
export async function onRequestGet() {
  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
}
