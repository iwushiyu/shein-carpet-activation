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
    const { code, user_id } = req.body

    // 验证输入参数
    if (!code || !user_id) {
      return res.status(400).json({
        success: false,
        message: '激活码和用户ID不能为空'
      })
    }

    // 查询激活码
    const { data: activationCode, error: codeError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (codeError || !activationCode) {
      return res.status(404).json({
        success: false,
        message: '激活码不存在'
      })
    }

    // 检查激活码状态
    if (activationCode.status === 'used') {
      return res.status(400).json({
        success: false,
        message: '激活码已被使用'
      })
    }

    // 检查激活码是否过期
    if (activationCode.expires_at && new Date(activationCode.expires_at) < new Date()) {
      // 更新激活码状态为过期
      await supabase
        .from('activation_codes')
        .update({ status: 'expired' })
        .eq('id', activationCode.id)

      return res.status(400).json({
        success: false,
        message: '激活码已过期'
      })
    }

    // 检查用户是否已经激活过
    const { data: existingActivation } = await supabase
      .from('user_activations')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (existingActivation) {
      return res.status(400).json({
        success: false,
        message: '该用户已经激活过'
      })
    }

    // 开始事务处理
    const now = new Date().toISOString()

    // 更新激活码状态
    const { error: updateError } = await supabase
      .from('activation_codes')
      .update({
        status: 'used',
        used_at: now,
        used_by: user_id
      })
      .eq('id', activationCode.id)

    if (updateError) {
      throw updateError
    }

    // 创建用户激活记录
    const { data: activationRecord, error: insertError } = await supabase
      .from('user_activations')
      .insert({
        user_id: user_id,
        activation_code_id: activationCode.id,
        activated_at: now,
        device_info: req.headers['user-agent'] || '',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      })
      .select()
      .single()

    if (insertError) {
      // 如果插入失败，回滚激活码状态
      await supabase
        .from('activation_codes')
        .update({
          status: 'unused',
          used_at: null,
          used_by: null
        })
        .eq('id', activationCode.id)

      throw insertError
    }

    return res.status(200).json({
      success: true,
      message: '激活成功',
      data: {
        activation_id: activationRecord.id,
        expires_at: activationCode.expires_at,
        activated_at: activationRecord.activated_at
      }
    })

  } catch (error) {
    console.error('激活验证错误:', error)
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
}
