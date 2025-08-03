// بداية كود الوظيفة الخلفية الكامل

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { auth_id, new_password } = await req.json();

    if (!auth_id || !new_password) {
      throw new Error("User auth_id and new_password are required.");
    }
    if (new_password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    // إنشاء عميل Supabase بصلاحيات الأدمن لتعديل بيانات المصادقة
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // استخدام دالة الأدمن لتحديث بيانات المستخدم عبر الـ ID
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      auth_id,
      { password: new_password }
    );

    if (error) {
      throw new Error(`Supabase Auth Error: ${error.message}`);
    }

    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// نهاية الكود