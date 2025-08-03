import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { applicant_id, shift_id } = await req.json();
    if (!applicant_id || !shift_id) {
      throw new Error("Applicant ID and Shift ID are required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const [{ data: applicant, error: applicantError }, { data: shift, error: shiftError }] = await Promise.all([
      supabaseAdmin.from('coverage_applicants').select('*').eq('id', applicant_id).single(),
      supabaseAdmin.from('coverage_shifts').select('*').eq('id', shift_id).single()
    ]);

    if (applicantError || !applicant) throw new Error("Applicant not found.");
    if (shiftError || !shift) throw new Error("Coverage shift not found.");

    let publicUserId;

    // --- NEW LOGIC STARTS HERE: Check for existing user ---
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id_number', applicant.id_number)
      .single();

    if (existingUser) {
      // User already exists, just update their status
      console.log(`User ${applicant.id_number} already exists with ID: ${existingUser.id}. Updating status.`);
      publicUserId = existingUser.id;
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ employment_status: 'تغطية' })
        .eq('id', publicUserId);

      if (updateError) throw new Error(`Failed to update existing user: ${updateError.message}`);
      
    } else {
      // User does not exist, create a new one
      console.log(`User ${applicant.id_number} not found. Creating new user.`);
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: `${applicant.id_number}@arknat-system.com`,
        password: applicant.id_number,
        email_confirm: true
      });

      if (createUserError) throw new Error(`Failed to create auth user: ${createUserError.message}`);

      const profileData = {
        auth_user_id: newUser.user.id,
        name: applicant.full_name,
        id_number: applicant.id_number,
        phone: applicant.phone_number,
        iban: applicant.iban,
        bank_name: applicant.bank_name || 'غير محدد',
        role: 'حارس أمن',
        employment_status: 'تغطية',
        status: 'active',
        project: [shift.project],
        location: shift.location,
        region: shift.region,
        city: shift.city,
        vacancy_id: shift.linked_vacancy_id || null
      };

      const { data: createdPublicUser, error: publicUserError } = await supabaseAdmin
        .from('users')
        .insert(profileData)
        .select('id')
        .single();

      if (publicUserError || !createdPublicUser) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw new Error(`Failed to create public user profile: ${publicUserError?.message}`);
      }
      publicUserId = createdPublicUser.id;
    }
    // --- NEW LOGIC ENDS HERE ---

    const paymentRecord = {
      coverage_shift_id: shift_id,
      applicant_id: applicant_id,
      covering_guard_name: applicant.full_name,
      payment_amount: shift.coverage_pay,
      applicant_iban: applicant.iban,
      applicant_bank_name: applicant.bank_name || 'غير محدد',
      shift_date: new Date(shift.created_at).toISOString().split('T')[0],
      status: 'completed_pending_ops_approval',
      absent_guard_id: shift.covered_user_id,
    };
    
    if (shift.covered_user_id) {
        paymentRecord.absent_guard_id = shift.covered_user_id;
    }

    const { error: paymentError } = await supabaseAdmin.from('coverage_payments').insert(paymentRecord);
    if (paymentError) throw new Error(`Failed to create payment record: ${paymentError.message}`);

    await Promise.all([
      supabaseAdmin.from('coverage_applicants').update({
        status: 'ops_final_approved',
        applicant_user_id: publicUserId
      }).eq('id', applicant_id),
      supabaseAdmin.from('coverage_shifts').update({
        status: 'closed'
      }).eq('id', shift_id)
    ]);

    return new Response(JSON.stringify({ message: "Coverage guard assigned successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('CRITICAL ERROR in assign-coverage-guard:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
