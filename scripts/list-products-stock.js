const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://ikryeyqrithikabwidov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo'
);
(async () => {
  const { data, error } = await sb.from('products').select('id,name,slug,stock,is_active').order('id');
  console.log(error || data);
})();
