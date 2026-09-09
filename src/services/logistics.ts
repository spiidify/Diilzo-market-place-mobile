// ── Logistics API Service (Pickup Stations + Shipment Tracking) ────

import { apiRequest } from './api';

/** Pickup station shape returned by the API. */
export interface PickUpStation {
  id: number;
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  operating_hours: string;
  contact_number: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  full_address: string;
  created_at: string;
  updated_at: string;
}

/** Global shipment tracking data. */
export interface GlobalShipment {
  id: number;
  order_number: string;
  order_status: string;
  tracking_number: string;
  carrier_slug: string;
  carrier_name: string;
  fulfillment_type: string;
  estimated_delivery_date: string | null;
  tracking_milestones: ShipmentMilestone[];
  last_updated: string | null;
  is_stale: boolean;
}

/** A single checkpoint in the shipment tracking timeline. */
export interface ShipmentMilestone {
  slug: string;
  location: string;
  message: string;
  checkpoint_time: string;
  tag: string;
  sub_tag: string;
  sub_tag_message: string;
  country_name: string;
  city: string;
  state: string;
  zip: string;
}

/** Response from the select-pickup endpoint. */
export interface SelectPickupResponse {
  detail: string;
  order_id: number;
  order_number: string;
  fulfillment_method: string;
  pickup_station: PickUpStation;
  pickup_status: string;
  collection_pin: string;
}

/** GET /api/v1/logistics/pickup-stations/ — list active pickup stations. */
export async function fetchPickupStations(params?: {
  city?: string;
  region?: string;
}): Promise<PickUpStation[]> {
  const data = await apiRequest<{ results: PickUpStation[] } | PickUpStation[]>({
    method: 'GET',
    url: '/logistics/pickup-stations/',
    params: { ...params, page_size: 100 },
  });
  // Handle both paginated and non-paginated responses.
  if (Array.isArray(data)) return data;
  return data.results || [];
}

/** PATCH /api/v1/orders/<id>/select-pickup/ — assign a pickup station to an order. */
export async function selectPickupStation(
  orderId: number,
  pickupStationId: number
): Promise<SelectPickupResponse> {
  return apiRequest<SelectPickupResponse>({
    method: 'PATCH',
    url: `/orders/${orderId}/select-pickup/`,
    data: { pickup_station_id: pickupStationId },
  });
}

/** GET /api/v1/orders/<id>/track-shipment/ — get global shipment tracking data. */
export async function fetchShipmentTracking(orderId: number): Promise<GlobalShipment> {
  return apiRequest<GlobalShipment>({
    method: 'GET',
    url: `/orders/${orderId}/track-shipment/`,
  });
}
