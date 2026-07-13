// Deterministic 4-digit delivery OTP derived from a parcel's tracking ID.
// In a real system the OTP is sent to the recipient; the rider asks for it and
// enters it to confirm delivery. Deriving it keeps the mock stable & testable.
export function deliveryOtp(trackingId: string): string {
  let hash = 0;
  for (let i = 0; i < trackingId.length; i++) {
    hash = (hash * 31 + trackingId.charCodeAt(i)) % 100000;
  }
  return String(hash % 10000).padStart(4, "0");
}
