update public.report_reviews
set notes = 'Report dismissed after moderator review'
where status = 'dismissed'
  and notes in ('Dismissed from moderation queue','Dismissed after moderator review');

update public.report_reviews
set notes = 'Ping removed after moderator review'
where status = 'actioned'
  and notes in ('Removed from moderation queue','Removed after moderator review');
