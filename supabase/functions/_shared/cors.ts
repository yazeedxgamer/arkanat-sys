// هذا الكود يسمح لموقعك المحلي بالتواصل مع الخادم بأمان
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}