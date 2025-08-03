import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { payment_id } = await req.json();
    if (!payment_id) throw new Error("Payment ID is required.");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: payment, error: e1 } = await supabaseAdmin
      .from('coverage_payments').select('*, coverage_shifts(id)').eq('id', payment_id).single();
    if (e1 || !payment) throw new Error("Payment record not found.");
    const { data: assignment, error: e2 } = await supabaseAdmin
      .from('coverage_assignments').select('*, users:covering_guard_id(auth_user_id)')
      .eq('coverage_shift_id', payment.coverage_shifts.id).single();
    if (e2 || !assignment) throw new Error("Coverage assignment record not found.");
    const auth_user_id = assignment.users?.auth_user_id;
    if (auth_user_id) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
        if (deleteError) console.error("Could not delete auth user, but proceeding:", deleteError.message);
    }
    await supabaseAdmin.from('coverage_payments').update({ status: 'paid' }).eq('id', payment.id);
    return new Response(JSON.stringify({ message: "Payment finalized and user archived successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
})