import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// 生成激活码
function generateActivationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  
  // 生成8位激活码
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  // 添加连字符，格式：XXXX-XXXX
  return result.slice(0, 4) + '-' + result.slice(4)
}

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  try {
    // 验证管理员密钥
    const authHeader = req.headers.authorization
    const adminSecret = process.env.ADMIN_SECRET

    if (!authHeader || !adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      })
    }

    const { count = 1, expires_days = 365, created_by = 'admin' } = req.body

    // 验证输入参数
    if (count < 1 || count > 1000) {
      return res.status(400).json({
        success: false,
        message: '生成数量必须在1-1000之间'
      })
    }

    if (expires_days < 1 || expires_days > 3650) {
      return res.status(400).json({
        success: false,
        message: '有效期必须在1-3650天之间'
      })
    }

    // 计算过期时间
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_days)

    // 生成激活码数组
    const activationCodes = []
    const codes = new Set() // 用于去重

    while (activationCodes.length < count) {
      const code = generateActivationCode()
      
      // 检查是否重复
      if (!codes.has(code)) {
        codes.add(code)
        activationCodes.push({
          code: code,
          status: 'unused',
          expires_at: expiresAt.toISOString(),
          created_by: created_by,
          created_at: new Date().toISOString()
        })
      }
    }

    // 批量插入数据库
    const { data, error } = await supabase
      .from('activation_codes')
      .insert(activationCodes)
      .select()

    if (error) {
      throw error
    }

    return res.status(200).json({
      success: true,
      message: `成功生成 ${data.length} 个激活码`,
      data: {
        codes: data.map(item => ({
          id: item.id,
          code: item.code,
          expires_at: item.expires_at
        })),
        total_count: data.length,
        expires_at: expiresAt.toISOString()
      }
    })

  } catch (error) {
    console.error('生成激活码错误:', error)
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
}
