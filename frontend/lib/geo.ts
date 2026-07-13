import upazilas from "@/lib/mock-data/upazilas.json";

const map = upazilas as Record<string, string[]>;

// Returns the Upazila/Thana list for a district (sorted A–Z), or an empty
// array if the district is unknown.
export function upazilasFor(district: string): string[] {
  return (map[district] ?? []).slice().sort((a, b) => a.localeCompare(b));
}
