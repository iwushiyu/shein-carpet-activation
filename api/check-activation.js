import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  try {
    const { user_id } = req.body

    // 验证输入参数
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      })
    }

    // 查询用户激活记录
    const { data: activation, error } = await supabase
      .from('user_activations')
      .select(`
        *,
        activation_codes (
          code,
          expires_at,
          status
        )
      `)
      .eq('user_id', user_id)
      .single()

    if (error || !activation) {
      return res.status(200).json({
        success: true,
        data: {
          is_activated: false,
          message: '用户未激活'
        }
      })
    }

    // 检查激活是否过期
    const activationCode = activation.activation_codes
    let isExpired = false

    if (activationCode.expires_at) {
      isExpired = new Date(activationCode.expires_at) < new Date()
    }

    // 如果激活码状态为已使用但已过期，更新状态
    if (isExpired && activationCode.status === 'used') {
      await supabase
        .from('activation_codes')
        .update({ status: 'expired' })
        .eq('id', activation.activation_code_id)
    }

    return res.status(200).json({
      success: true,
      data: {
        is_activated: !isExpired,
        activation_info: {
          activation_id: activation.id,
          activated_at: activation.activated_at,
          expires_at: activationCode.expires_at,
          code: activationCode.code
        },
        message: isExpired ? '激活已过期' : '用户已激活'
      }
    })

  } catch (error) {
    console.error('检查激活状态错误:', error)
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
}
