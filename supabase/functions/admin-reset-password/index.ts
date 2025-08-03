import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { auth_id, new_password } = await req.json();
    if (!auth_id || !new_password || new_password.length < 6) {
      throw new Error("User ID and a valid password (min 6 chars) are required.");
    }

    // Create a Supabase client with the user's authorization header
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user who is making the request
    const { data: { user: callingUser } } = await userSupabaseClient.auth.getUser();
    if (!callingUser) {
      throw new Error("Could not identify the calling user.");
    }

    // Check if the calling user is a System Admin
    const { data: adminProfile, error: adminError } = await userSupabaseClient
      .from('users')
      .select('role')
      .eq('auth_user_id', callingUser.id)
      .single();
    
    if (adminError || adminProfile?.role !== 'مدير النظام') {
      return new Response(JSON.stringify({ error: 'Permission denied: Only System Admins can perform this action.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // If the check passes, create a privileged admin client to perform the action
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update the target user's password
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      auth_id,
      { password: new_password }
    );

    if (updateError) {
      throw new Error(updateError.message);
    }

    return new Response(JSON.stringify({ message: "Password updated successfully" }), {
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