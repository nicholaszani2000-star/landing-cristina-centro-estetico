-- supabase/iscritti.sql — iscrizioni al codice sconto (CLAUDE.md §2.4, §4, §10).
--
-- COME APPLICARLO (allo Step 9, non prima):
--   1. Crea il progetto Supabase in una regione dell'Unione europea.
--   2. Apri SQL Editor, incolla tutto questo file ed eseguilo. Si può rieseguire senza danni:
--      la tabella si crea solo se manca, la funzione si sostituisce, i permessi si riassegnano.
--   Provato su Postgres 16 con i ruoli di Supabase (anon, authenticated, service_role) prima del commit.
--   3. Su Netlify, Project configuration › Environment variables, crea con ambito «Functions»
--      e segnate come segrete:
--        SUPABASE_URL         l'indirizzo del progetto (https://<id>.supabase.co)
--        SUPABASE_SECRET_KEY  la chiave segreta (sb_secret_…), mai nel browser
--      Le chiavi non vanno MAI in questo repository né in chat (§2.5).
--   4. Ripubblica il sito: la funzione esce dalla «modalità prova» e salva le iscrizioni.
--
-- Sicurezza (documentazione Supabase, «Row Level Security»): le tabelle create in SQL hanno RLS spento
-- e i permessi predefiniti per anon e authenticated. Qui RLS è acceso, senza policy, e solo service_role
-- (la chiave segreta, usata dalla Netlify Function) può leggere, scrivere ed eseguire la funzione.

-- ------------------------------------------------------------------ tabella

create table if not exists public.iscritti (
  id                bigint generated always as identity primary key,
  email             text not null check (char_length(email) <= 254),
  email_norm        text generated always as (lower(trim(email))) stored,
  codice            text not null,
  scadenza          date not null,
  consenso_testo    text not null,
  consenso_versione text not null,
  pagina            text,
  utm               jsonb not null default '{}'::jsonb,
  creato_il         timestamptz not null default now(),
  usato_il          timestamptz null,
  disiscritto_il    timestamptz null,
  constraint iscritti_email_norm_unica unique (email_norm),
  constraint iscritti_codice_unico unique (codice)
);

comment on table public.iscritti is
  'Iscrizioni al codice sconto con la prova del consenso (email, data e ora, testo e versione del consenso, pagina). Una riga per email.';

alter table public.iscritti enable row level security;
-- Nessuna policy: con RLS acceso anon e authenticated non vedono nulla; service_role scavalca RLS.
-- Supabase dà in automatico tutti i permessi delle nuove tabelle anche a service_role: li togliamo e
-- lasciamo solo lettura, inserimento e modifica (niente delete o truncate dalla Function).
revoke all on table public.iscritti from anon, authenticated, service_role;
grant select, insert, update on table public.iscritti to service_role;

-- ------------------------------------------------------------------ funzione

-- Iscrive un'email. Se c'è già (stessa email, maiuscole e spazi a parte) non cambia nulla e restituisce
-- il codice esistente con nuovo = false. Un codice già usato da un'altra email fa fallire l'inserimento
-- (vincolo iscritti_codice_unico, errore 23505): la Netlify Function riprova con un codice nuovo.
create or replace function public.iscrivi_email(
  p_email             text,
  p_codice            text,
  p_scadenza          date,
  p_consenso_testo    text,
  p_consenso_versione text,
  p_pagina            text,
  p_utm               jsonb
)
returns table (codice text, scadenza date, nuovo boolean)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_codice   text;
  v_scadenza date;
begin
  insert into public.iscritti as i (email, codice, scadenza, consenso_testo, consenso_versione, pagina, utm)
  values (p_email, p_codice, p_scadenza, p_consenso_testo, p_consenso_versione, p_pagina, coalesce(p_utm, '{}'::jsonb))
  on conflict (email_norm) do nothing
  returning i.codice, i.scadenza into v_codice, v_scadenza;

  if found then
    return query select v_codice, v_scadenza, true;
  else
    return query
      select i.codice, i.scadenza, false
      from public.iscritti as i
      where i.email_norm = lower(trim(p_email));
  end if;
end;
$$;

revoke execute on function public.iscrivi_email(text, text, date, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.iscrivi_email(text, text, date, text, text, text, jsonb) to service_role;

-- ------------------------------------------------------------------ pulizia (Step 9)

-- Conservazione promessa dall'informativa privacy: fino alla revoca del consenso e comunque non oltre
-- 24 mesi dall'ultima interazione (iscrizione o uso del codice). Restituisce quante righe ha cancellato.
create or replace function public.pulisci_iscritti()
returns integer
language sql
security invoker
set search_path = public
as $$
  with cancellate as (
    delete from public.iscritti
    where disiscritto_il is not null
       or greatest(creato_il, coalesce(usato_il, creato_il)) < now() - interval '24 months'
    returning 1
  )
  select count(*)::integer from cancellate;
$$;

revoke execute on function public.pulisci_iscritti() from public, anon, authenticated, service_role;

-- Ogni giorno alle 03:17 UTC con Supabase Cron (documentazione Supabase, «Cron › Install»).
-- Il job gira come postgres; rieseguendo il file, cron.schedule con lo stesso nome aggiorna il job.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('pulizia-iscritti', '17 3 * * *', $$select public.pulisci_iscritti()$$);
