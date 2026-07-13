import {
  LayoutDashboard,
  Users,
  Package,
  Map,
  Wallet,
  BarChart3,
  Settings,
  PlusCircle,
  Upload,
  UserCircle,
  Bike,
  Calculator,
  CreditCard,
  Inbox,
  Building2,
  LifeBuoy,
  Code2,
  PackageOpen,
  Route,
  type LucideIcon,
} from "lucide-react";
import type {
  ParcelStatus,
  MerchantStatus,
  Role,
  WithdrawalStatus,
  SupportStatus,
  SupportCategory,
  SupportPriority,
} from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Merchants", href: "/admin/merchants", icon: Users },
  { label: "Parcels", href: "/admin/parcels", icon: Package },
  { label: "Pickup Requests", href: "/admin/pickup-requests", icon: Inbox },
  { label: "Delivery Men", href: "/admin/delivery-men", icon: Bike },
  { label: "Hubs", href: "/admin/branches", icon: Building2 },
  { label: "Zones", href: "/admin/zones", icon: Map },
  { label: "COD", href: "/admin/cod", icon: Wallet },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export const MERCHANT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/merchant/dashboard", icon: LayoutDashboard },
  { label: "Book Parcel", href: "/merchant/parcels/new", icon: PlusCircle },
  { label: "My Parcels", href: "/merchant/parcels", icon: Package },
  { label: "Import", href: "/merchant/parcels/import", icon: Upload },
  { label: "Pricing", href: "/merchant/pricing", icon: Calculator },
  { label: "COD", href: "/merchant/cod", icon: Wallet },
  { label: "Payments", href: "/merchant/payments", icon: CreditCard },
  { label: "Reports", href: "/merchant/reports", icon: BarChart3 },
  { label: "Developers", href: "/merchant/developers", icon: Code2 },
  { label: "Support", href: "/merchant/support", icon: LifeBuoy },
  { label: "Profile", href: "/merchant/profile", icon: UserCircle },
];

// Branch Manager panel — hub-scoped operations only.
export const BRANCH_NAV: NavItem[] = [
  { label: "Dashboard", href: "/branch/dashboard", icon: LayoutDashboard },
  { label: "Pickup Requests", href: "/branch/pickup-requests", icon: Inbox },
  { label: "Parcels", href: "/branch/parcels", icon: Package },
  { label: "Bags", href: "/branch/bags", icon: PackageOpen },
  { label: "Trips", href: "/branch/trips", icon: Route },
  { label: "Areas", href: "/branch/areas", icon: Map },
  { label: "Delivery Men", href: "/branch/delivery-men", icon: Bike },
  { label: "COD", href: "/branch/cod", icon: Wallet },
  { label: "Reports", href: "/branch/reports", icon: BarChart3 },
];

// Delivery man (rider) panel — mobile bottom-tab navigation.
export const RIDER_NAV: NavItem[] = [
  { label: "Home", href: "/rider/dashboard", icon: LayoutDashboard },
  { label: "Trip", href: "/rider/trip", icon: Route },
  { label: "Parcels", href: "/rider/parcels", icon: Package },
  { label: "Cash", href: "/rider/cod", icon: Wallet },
  { label: "Profile", href: "/rider/profile", icon: UserCircle },
];

export function navForRole(role: Role): NavItem[] {
  if (role === "merchant") return MERCHANT_NAV;
  if (role === "branch_manager") return BRANCH_NAV;
  if (role === "delivery_man") return RIDER_NAV;
  return ADMIN_NAV;
}

export function panelLabelForRole(role: Role): string {
  if (role === "merchant") return "Merchant";
  if (role === "branch_manager") return "Hub";
  if (role === "delivery_man") return "Rider";
  return "Admin";
}

// Status label + Tailwind classes for badges.
export const PARCEL_STATUS_META: Record<
  ParcelStatus,
  { label: string; classes: string }
> = {
  pending: { label: "Pending", classes: "bg-warning-100 text-warning-700" },
  picked_up: { label: "Picked Up", classes: "bg-info-100 text-info-700" },
  in_transit: { label: "In Transit", classes: "bg-blue-100 text-blue-700" },
  at_hub: { label: "At Hub", classes: "bg-indigo-100 text-indigo-700" },
  out_for_delivery: {
    label: "Out for Delivery",
    classes: "bg-violet-100 text-violet-700",
  },
  delivered: { label: "Delivered", classes: "bg-success-100 text-success-700" },
  partially_delivered: {
    label: "Partially Delivered",
    classes: "bg-teal-100 text-teal-700",
  },
  return_in_transit: {
    label: "Return in Transit",
    classes: "bg-orange-100 text-orange-700",
  },
  returned: { label: "Returned", classes: "bg-danger-100 text-danger-700" },
  cancelled: { label: "Cancelled", classes: "bg-slate-100 text-slate-600" },
};

export const MERCHANT_STATUS_META: Record<
  MerchantStatus,
  { label: string; classes: string }
> = {
  pending: { label: "Pending", classes: "bg-warning-100 text-warning-700" },
  active: { label: "Active", classes: "bg-success-100 text-success-700" },
  suspended: { label: "Suspended", classes: "bg-danger-100 text-danger-700" },
};

export const WITHDRAWAL_STATUS_META: Record<
  WithdrawalStatus,
  { label: string; classes: string }
> = {
  pending: { label: "Pending", classes: "bg-warning-100 text-warning-700" },
  approved: { label: "Approved", classes: "bg-info-100 text-info-700" },
  paid: { label: "Paid", classes: "bg-success-100 text-success-700" },
  rejected: { label: "Rejected", classes: "bg-danger-100 text-danger-700" },
};

export const SUPPORT_STATUS_META: Record<
  SupportStatus,
  { label: string; classes: string }
> = {
  open: { label: "Open", classes: "bg-warning-100 text-warning-700" },
  in_progress: { label: "In Progress", classes: "bg-info-100 text-info-700" },
  resolved: { label: "Resolved", classes: "bg-success-100 text-success-700" },
  closed: { label: "Closed", classes: "bg-slate-100 text-slate-600" },
};

export const SUPPORT_CATEGORY_META: Record<SupportCategory, string> = {
  parcel: "Parcel Issue",
  payment: "Payment / COD",
  pickup: "Pickup",
  account: "Account",
  other: "Other",
};

export const SUPPORT_PRIORITY_META: Record<
  SupportPriority,
  { label: string; classes: string }
> = {
  low: { label: "Low", classes: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", classes: "bg-info-100 text-info-700" },
  high: { label: "High", classes: "bg-danger-100 text-danger-700" },
};

// Districts we currently operate in. Initial launch is Dhaka-only; add more
// here (and set up their hubs) to expand coverage — the booking form and area
// picker read from this list.
export const SERVICE_DISTRICTS: string[] = ["Dhaka"];

// Full Bangladesh district list (64) — retained for zone config and future
// expansion; booking is limited to SERVICE_DISTRICTS.
export const BD_DISTRICTS: string[] = [
  "Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur",
  "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari",
  "Shariatpur", "Tangail", "Chattogram", "Bandarban", "Brahmanbaria",
  "Chandpur", "Cumilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur",
  "Noakhali", "Rangamati", "Sylhet", "Habiganj", "Moulvibazar", "Sunamganj",
  "Rajshahi", "Bogura", "Joypurhat", "Naogaon", "Natore", "Chapainawabganj",
  "Pabna", "Sirajganj", "Khulna", "Bagerhat", "Chuadanga", "Jashore",
  "Jhenaidah", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira",
  "Barishal", "Barguna", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur",
  "Rangpur", "Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari",
  "Panchagarh", "Thakurgaon", "Mymensingh", "Jamalpur", "Netrokona", "Sherpur",
].sort((a, b) => a.localeCompare(b)); // shown A–Z in district dropdowns

// Hardcoded demo credentials for M1 mock auth (replaced by real API in M4).
export const MOCK_CREDENTIALS: Record<
  string,
  { password: string; role: Role; name: string; branchId?: number }
> = {
  "admin@cms.com": { password: "admin123", role: "admin", name: "System Admin" },
  "merchant@cms.com": {
    password: "merchant123",
    role: "merchant",
    name: "Karim Traders",
  },
  // Branch Manager demo — bound to the Chattogram hub (branch id 2).
  "branch@cms.com": {
    password: "branch123",
    role: "branch_manager",
    name: "Chattogram Hub Manager",
    branchId: 2,
  },
  // Central Hub Manager demo — bound to the Dhaka Central Hub (branch id 1).
  // Operates the central sorting hub: accepts inbound, dispatches onward.
  "central@cms.com": {
    password: "central123",
    role: "branch_manager",
    name: "Central Hub Manager",
    branchId: 1,
  },
};

// Demo accounts for the login page quick-fill. These mirror the backend
// `reset_seed` command exactly, so every button logs in against the real API.
export const DEMO_LOGINS: {
  label: string;
  email: string;
  password: string;
}[] = [
  { label: "Admin", email: "admin@cms.com", password: "admin123" },
  { label: "Merchant", email: "merchant@cms.com", password: "merchant123" },
  { label: "Central Hub", email: "central@cms.com", password: "central123" },
  { label: "Mirpur Hub", email: "mirpur@cms.com", password: "mirpur123" },
  { label: "Gulshan Hub", email: "gulshan@cms.com", password: "gulshan123" },
];
