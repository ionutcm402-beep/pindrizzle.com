do $$ begin
  alter publication supabase_realtime add table public.ping_hides;
exception when duplicate_object then null;
end $$;
