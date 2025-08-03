import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sign } from "https://deno.land/x/djwt@v2.8/mod.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target_user_id } = await req.json();
    if (!target_user_id) throw new Error("Target User ID is required.");

    // 1. إنشاء عميل Supabase بناءً على طلب المستخدم للتحقق من صلاحياته
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user: callingUser } } = await userSupabaseClient.auth.getUser();
    if (!callingUser) throw new Error("Could not identify the calling user.");

    // 2. التحقق من أن المستخدم الذي استدعى الوظيفة هو "مدير النظام"
    const { data: adminProfile, error: adminError } = await userSupabaseClient
      .from('users').select('role').eq('auth_user_id', callingUser.id).single();
    
    if (adminError || adminProfile?.role !== 'مدير النظام') {
      return new Response(JSON.stringify({ error: 'Permission Denied' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // 3. إذا كان مديرًا، قم بإنشاء توكن مخصص للمستخدم المستهدف
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    if(!targetUser) throw new Error("Target user not found.");

    const customToken = await sign(
        { 
            ...targetUser.app_metadata, 
            aud: 'authenticated', 
            sub: targetUser.id, 
            role: 'authenticated',
            exp: Math.floor(Date.now() / 1000) + (60 * 60) // صلاحية لمدة ساعة واحدة
        },
        Deno.env.get('SUPABASE_JWT_SECRET')!,
        "HS256"
    );

    return new Response(JSON.stringify({ access_token: customToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});