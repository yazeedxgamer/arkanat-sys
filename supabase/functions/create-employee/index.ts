import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // طباعة أولية للتأكد من استدعاء الدالة
  console.log('--- create-employee function invoked ---');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('--- Entering TRY block ---');
    const { password, ...profileDataFromRequest } = await req.json();
    console.log('--- Request body parsed. Data received:', profileDataFromRequest);

    const { name, id_number, role } = profileDataFromRequest;

    if (!id_number || !password || !name || !role) {
      throw new Error("الحقول الأساسية (الاسم، رقم الهوية، كلمة المرور، الدور) مطلوبة.");
    }
    console.log('--- Basic validation passed ---');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('--- Supabase admin client created ---');

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id_number', id_number)
      .maybeSingle();

    console.log('--- Checked for existing user in public.users ---');
    if (existingUser) {
      throw new Error("فشل الإنشاء: رقم الهوية هذا مسجل مسبقاً في النظام لموظف آخر.");
    }

    console.log('--- Creating user in auth.users ---');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: `${id_number}@arknat-system.com`,
      password: password,
      user_metadata: { name: name, role: role },
      email_confirm: true,
    });

    if (authError) throw authError;
    console.log('--- Auth user created successfully. Auth ID:', user.id);

    const profileDataToInsert = {
      ...profileDataFromRequest,
      auth_user_id: user.id,
    };

    console.log('--- Inserting profile into public.users ---');
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert(profileDataToInsert)
      .select()
      .single();

    if (profileError) {
      console.error('--- Error inserting profile. Deleting orphaned auth user... ---');
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      throw new Error(`فشل حفظ الملف الشخصي: ${profileError.message}`);
    }
    console.log('--- Profile inserted successfully. New Profile:', newProfile);

    return new Response(JSON.stringify({
      success: true,
      data: newProfile 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // أهم جزء: طباعة الخطأ بالتفصيل في السجلات
    console.error('--- CRITICAL ERROR in CATCH block ---:', error);

    return new Response(JSON.stringify({
      error: `Server Error: ${error.message}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Internal Server Error
    });
  }
})