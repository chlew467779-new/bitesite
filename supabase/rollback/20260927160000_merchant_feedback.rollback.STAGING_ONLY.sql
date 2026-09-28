-- ROLLBACK of 20260927160000_merchant_feedback.sql - STAGING ONLY.
-- Roll back the application first (Owner feedback route/panel, Admin Feedback page).
-- Export public.merchant_feedback first if the messages must be kept: this drops them.
begin;
do $$ begin
  if 'NO' <> 'yes' then
    raise exception 'Rollback switch is off. Edit deliberately to allow this rollback.';
  end if;
end $$;
drop function if exists public.merchant_feedback_update(text,text,uuid,text,text);
drop function if exists public.merchant_feedback_queue(text,text,text);
drop function if exists public.merchant_feedback_list(text,text,uuid);
drop function if exists public.merchant_feedback_submit(text,text,uuid,uuid,text,text);
drop function if exists private.merchant_feedback_json(public.merchant_feedback);
drop table if exists public.merchant_feedback;
commit;
