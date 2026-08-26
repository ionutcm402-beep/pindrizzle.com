revoke execute on function public.my_promotable_pings() from anon;
revoke execute on function public.my_promotion_requests() from anon;
revoke execute on function public.promotion_price_pence(integer, integer) from anon;
revoke execute on function public.submit_promotion_request(uuid,text,integer,integer) from anon;

grant execute on function public.my_promotable_pings() to authenticated;
grant execute on function public.my_promotion_requests() to authenticated;
grant execute on function public.promotion_price_pence(integer, integer) to authenticated;
grant execute on function public.submit_promotion_request(uuid,text,integer,integer) to authenticated;
