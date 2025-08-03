import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // التعامل مع طلبات OPTIONS الخاصة بالـ CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, auth_user_id } = await req.json()

    // التحقق من وصول البيانات المطلوبة
    if (!user_id || !auth_user_id) {
      throw new Error("User ID and Auth User ID are required.");
    }

    // إنشاء اتصال آمن بقاعدة البيانات باستخدام مفتاح الخدمة
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. قبل حذف الموظف، ابحث عن الشاغر المرتبط به
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('vacancy_id')
      .eq('id', user_id)
      .single();

    if (fetchError) {
      console.warn(`Could not find user ${user_id} to get vacancy ID. Maybe already deleted.`, fetchError.message);
    }

    // 2. حذف الموظف من نظام المصادقة (Authentication)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
    // نتجاهل الخطأ إذا كان المستخدم محذوفاً بالفعل
    if (authError && authError.message !== 'User not found') {
        throw authError;
    }

    // 3. حذف سجل الموظف من جدول users (سيتم حذفه تلقائياً بسبب الربط، ولكن هذا للتأكيد)
    await supabaseAdmin.from('users').delete().eq('id', user_id);

    // 4. إذا كان هناك شاغر مرتبط بالموظف، قم بفتحه
    if (userData && userData.vacancy_id) {
      const { error: vacancyError } = await supabaseAdmin
        .from('job_vacancies')
        .update({ status: 'open' }) // <-- هذا هو الأمر المهم: فتح الشاغر
        .eq('id', userData.vacancy_id);

      if (vacancyError) {
        // لا نوقف العملية إذا فشلت هذه الخطوة، ولكن نسجل الخطأ
        console.error("Important: Could not reopen vacancy.", vacancyError.message);
      }
    }

    // 5. إرجاع رسالة نجاح
    return new Response(JSON.stringify({ message: 'User deleted successfully and vacancy status updated.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // في حال حدوث أي خطأ، يتم إرجاعه هنا
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})