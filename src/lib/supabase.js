import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://biihykqyxrdykxhwgbvz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWh5a3F5eHJkeWt4aHdnYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjY5NDEsImV4cCI6MjA4OTM0Mjk0MX0.2obnVhe5KgDYXoAqLscWQmxAzlXLw20hNMBx-BMLrWw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

