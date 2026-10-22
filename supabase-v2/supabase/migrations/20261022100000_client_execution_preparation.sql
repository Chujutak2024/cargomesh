-- Client-safe aggregate only: no driver identity, carrier roster or private cost data.
begin;
create function public.read_v2_execution_preparation(p_organization_id uuid,p_member_id uuid,p_execution_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.transport_executions;required_count integer;vehicle_count integer;driver_count integer;non_asset integer;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select * into e from public.transport_executions where id=p_execution_id and organization_id=p_organization_id;
 if e.id is null then raise exception 'EXECUTION_NOT_FOUND' using errcode='PT404';end if;
 select count(distinct r.asset_id),count(*) filter(where r.asset_id is null) into required_count,non_asset
 from public.capacity_reservations h join public.plan_resources r on r.id=h.plan_resource_id
 where h.execution_id=e.id and h.status='CONFIRMED' and h.parent_reservation_id is null;
 select count(distinct a.transport_asset_id) into vehicle_count from public.vehicle_assignments a
 join public.capacity_reservations h on h.id=a.capacity_reservation_id
 join public.plan_resources r on r.id=h.plan_resource_id and r.asset_id=a.transport_asset_id
 where a.execution_id=e.id and a.carrier_id=e.carrier_id and a.carrier_service_id=e.carrier_service_id
 and a.status='CONFIRMED' and h.execution_id=e.id and h.status='CONFIRMED' and h.parent_reservation_id is null
 and a.starts_at<=h.starts_at and a.ends_at>=h.ends_at;
 select count(distinct driver_id) into driver_count from public.driver_assignments a
 where a.execution_id=e.id and a.carrier_id=e.carrier_id and a.carrier_service_id=e.carrier_service_id
 and a.status='CONFIRMED' and a.role='PRIMARY' and a.starts_at<=e.planned_starts_at and a.ends_at>=e.planned_ends_at;
 return jsonb_build_object('schemaVersion','2.0','executionId',e.id,'organizationId',e.organization_id,'requestId',e.freight_request_id,
 'status',case when non_asset>0 or required_count=0 then 'UNKNOWN' when vehicle_count=required_count and driver_count>=required_count then 'ASSIGNED' else 'PENDING' end,
 'vehicleCount',vehicle_count,'driverCount',driver_count,'requiredVehicles',required_count,'checkedAt',now(),'operationalClearance','NOT_EVALUATED');
end;$$;
revoke all on function public.read_v2_execution_preparation(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_v2_execution_preparation(uuid,uuid,uuid) to authenticated;
commit;
