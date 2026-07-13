// Shared TypeScript interfaces for the Courier Management System frontend.

// "branch_manager" runs a single hub; "delivery_man" is the rider panel.
export type Role =
  | "admin"
  | "merchant"
  | "super_admin"
  | "branch_manager"
  | "delivery_man";

export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  role: Role;
}

export interface AuthSession {
  token: string;
  role: Role;
  name: string;
  email: string;
  branchId?: number | null; // set for branch staff; null/undefined = HQ
  deliveryManId?: number | null; // set for the delivery_man (rider) role
}

// ---- Branches / Hubs (multi-branch system) ----

export type BranchType = "central" | "hub";

export interface Branch {
  id: number;
  name: string;
  code: string; // e.g. "DHK-CEN" — used on labels/tracking
  type: BranchType;
  phone: string;
  address: string;
  district: string;
  thana: string;
  // Areas this hub delivers to, as qualified "District/Thana" keys
  // (thana names are not globally unique).
  coverageThanas: string[];
  managerUserId: number | null;
  isActive: boolean;
  createdAt: string;
}

export type MerchantStatus = "pending" | "active" | "suspended";

export interface Merchant {
  id: number;
  name: string; // owner full name
  shopName: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  businessType: string;
  status: MerchantStatus;
  joinDate: string; // ISO date
  codCollected: number;
  codDisbursed: number;
  codPending: number;
  homeBranchId?: number; // origin hub for pickups
}

export type DeliveryManStatus = "active" | "inactive";

export interface DeliveryMan {
  id: number;
  name: string;
  phone: string;
  email: string;
  nid?: string; // National ID number — optional credential
  passport?: string; // passport number — optional credential
  photo?: string; // profile photo (data URL) — optional
  nidImage?: string; // uploaded NID document (data URL) — optional
  passportImage?: string; // uploaded passport document (data URL) — optional
  status: DeliveryManStatus;
  branchId?: number; // hub the rider belongs to
  areas?: string[]; // delivery areas covered ("District/Thana" keys)
  createdAt: string; // ISO date
}

export type ParcelStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "at_hub"
  | "out_for_delivery"
  | "delivered"
  | "partially_delivered"
  | "return_in_transit"
  | "returned"
  | "cancelled";

export type DeliveryType = "regular" | "express";

// Home delivery (to recipient's address) vs Point delivery (collected from a hub).
export type DeliveryMethod = "home" | "point";

// Optional proof a rider attaches when completing a delivery (in addition to
// the required OTP): a photo (data URL) and/or a short note.
export interface DeliveryProof {
  photo?: string;
  note?: string;
}

export interface ParcelStatusEvent {
  status: ParcelStatus;
  eventType?: string; // scan type: hub_inbound, hub_outbound, delivered, return, …
  hubName?: string | null; // hub the scan happened at
  remark?: string;
  changedBy?: string;
  timestamp: string; // ISO datetime
  proof?: DeliveryProof;
}

export interface Parcel {
  id: number;
  trackingId: string;
  merchantId: number;
  merchantName: string;
  merchantPhone?: string;
  pickupAddress?: string;
  recipientName: string;
  recipientPhone: string;
  alternativePhone?: string;
  recipientEmail?: string;
  recipientAddress: string;
  district: string;
  upazila?: string; // Upazila / Thana within the district
  zone: string;
  // Hub routing (multi-branch). origin = pickup hub, destination = delivery hub,
  // current = where the parcel physically is now.
  originBranchId?: number;
  destinationBranchId?: number;
  currentBranchId?: number;
  // Managing hub — the merchant's assigned branch. This hub (and HQ) exclusively
  // manage/see the parcel; other hubs cannot.
  ownerBranchId?: number;
  deliveryType: DeliveryType;
  deliveryMethod?: DeliveryMethod;
  weight: number; // kg
  productDescription: string; // item description
  specialInstructions?: string; // note
  invoiceNumber?: string;
  isExchange?: boolean;
  codAmount: number;
  // Cash actually collected at delivery. Equals codAmount on a full delivery;
  // less on a partial delivery (rest of the order returned). Undefined until
  // the parcel is delivered/partially delivered.
  collectedCod?: number;
  deliveryCharge: number;
  codCharge: number;
  totalCharge: number;
  status: ParcelStatus;
  deliveryManId?: number; // assigned delivery man (admin-assigned)
  returning?: boolean; // RTO: routing reversed to origin
  reattemptCount?: number;
  createdAt: string; // ISO date
  history: ParcelStatusEvent[];
}

export interface Zone {
  id: number;
  name: string;
  districts: string[];
  regularCharge: number;
  expressCharge: number;
  codChargePercent: number;
  returnCharge: number;
  isActive: boolean;
}

// ---- Payments / Withdrawals ----

export type PayoutMethodType = "bank" | "mobile";

// A payout channel the platform supports (admin-managed).
export interface AvailablePaymentMethod {
  id: number;
  name: string; // e.g. "bKash", "Nagad", "Bank Transfer"
  type: PayoutMethodType;
  isActive: boolean;
  minAmount: number; // minimum withdrawal
  chargePercent: number; // withdrawal handling charge %
  instructions?: string;
}

// A merchant's own configured payout account (uses an available method).
export interface MerchantPayoutMethod {
  id: number;
  merchantId: number;
  methodId: number; // -> AvailablePaymentMethod
  methodName: string; // denormalized for display
  type: PayoutMethodType;
  accountName: string;
  accountNumber: string;
  bankName?: string; // bank type only
  branch?: string; // bank type only
  isDefault: boolean;
}

// Cash a hub remits to HQ for the COD it collected on delivery.
export type RemittanceStatus = "pending" | "received";

export interface HubRemittance {
  id: number;
  branchId: number;
  amount: number;
  parcelCount: number;
  reference: string;
  status: RemittanceStatus;
  note?: string;
  remittedAt: string; // ISO date — when the hub sent it
  receivedAt?: string; // ISO date — when HQ confirmed
}

// Rider → hub cash handover. A rider collects COD on delivered parcels and
// hands the cash to their hub (status "pending"); the hub confirms receipt
// (status "received"). Mirrors the hub → HQ remittance chain.
export interface RiderHandover {
  id: number;
  riderId: number;
  riderName: string;
  branchId: number;
  amount: number;
  parcelCount: number;
  parcelIds: number[]; // delivered parcels whose COD this handover covers
  reference: string;
  status: RemittanceStatus;
  remittedAt: string; // ISO date — when the rider handed over
  receivedAt?: string; // ISO date — when the hub confirmed
  confirmedBy?: string;
}

// In-app notification surfaced in the rider panel (e.g. a new parcel assignment).
export type RiderNotificationType = "assignment" | "reassignment";

export interface RiderNotification {
  id: number;
  riderId: number;
  type: RiderNotificationType;
  title: string;
  body: string;
  parcelId?: number;
  trackingId?: string;
  read: boolean;
  createdAt: string; // ISO datetime
}

export type WithdrawalStatus = "pending" | "approved" | "paid" | "rejected";

export interface WithdrawalRequest {
  id: number;
  merchantId: number;
  merchantName: string;
  amount: number;
  charge: number;
  payoutMethodId: number;
  payoutLabel: string; // e.g. "bKash · 01711000001"
  status: WithdrawalStatus;
  requestedAt: string; // ISO date
  processedAt?: string; // ISO date
  reference?: string;
  note?: string;
}

// ---- Support tickets (merchant ↔ admin) ----

export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";
export type SupportCategory =
  | "parcel"
  | "payment"
  | "pickup"
  | "account"
  | "other";
export type SupportPriority = "low" | "medium" | "high";

export interface SupportMessage {
  id: number;
  sender: "merchant" | "admin";
  senderName: string;
  body: string;
  attachment?: string; // image data URL
  createdAt: string; // ISO datetime
}

export interface SupportTicket {
  id: number;
  ref: string; // e.g. TKT-0001
  merchantId: number;
  merchantName: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  trackingId?: string; // optional reference to a parcel
  messages: SupportMessage[]; // [0] is the merchant's opening message
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime — bumped on every message/status change
  unreadForAdmin: boolean; // merchant posted; cleared when admin opens it
  unreadForMerchant: boolean; // admin posted; cleared when merchant opens it
}

// Generic paginated list shape used across list pages.
export interface Paginated<T> {
  results: T[];
  count: number;
  page: number;
  pageSize: number;
}
