-- Structural only. Existing form-created requests keep both columns NULL.
alter table public.freight_requests
  add column creation_idempotency_key uuid,
  add column creation_payload_hash text,
  add constraint freight_requests_creation_receipt_check check (
    (creation_idempotency_key is null and creation_payload_hash is null)
    or (creation_idempotency_key is not null and creation_payload_hash is not null
        and requested_by_member_id is not null
        and creation_payload_hash ~ '^[0-9a-f]{64}$')
  );

create unique index freight_requests_creation_idempotency_idx
  on public.freight_requests (organization_id, requested_by_member_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

-- Even a direct authenticated Data API client cannot reserve another
-- member's idempotency key. Existing manager INSERT policy still applies.
create policy freight_requests_creation_receipt_owner on public.freight_requests
as restrictive for insert to authenticated
with check (
  creation_idempotency_key is null or exists (
    select 1 from public.organization_members m
    where m.id = requested_by_member_id
      and m.organization_id = freight_requests.organization_id
      and m.auth_user_id = (select auth.uid())
      and m.status = 'ACTIVE' and m.role in ('OWNER', 'SUPERVISOR')
  )
);

-- Editing a draft must not detach it from its original creation receipt.
create function private.guard_freight_creation_receipt()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.creation_idempotency_key is distinct from old.creation_idempotency_key
    or new.creation_payload_hash is distinct from old.creation_payload_hash
    or (old.creation_idempotency_key is not null and (
      new.organization_id is distinct from old.organization_id
      or new.requested_by_member_id is distinct from old.requested_by_member_id
      or new.code is distinct from old.code
    )) then
    raise exception 'Creation receipt is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_freight_creation_receipt() from public;
create trigger guard_freight_creation_receipt
  before update on public.freight_requests
  for each row execute function private.guard_freight_creation_receipt();
