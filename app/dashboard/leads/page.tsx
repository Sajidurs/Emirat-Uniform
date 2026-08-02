import { createClient } from "@/lib/supabase/server";
import LeadsTable from "@/components/dashboard/LeadsTable";
import PageHeader from "@/components/dashboard/ui/PageHeader";
import type { Branch, LeadRow, Location } from "@/lib/types";

interface RawCustomer {
  phone_number: string;
  name: string | null;
  first_seen: string;
  branch: { id: number; name: string; location: { id: number; name: string } | null } | null;
}

export default async function LeadsPage() {
  const supabase = await createClient();

  const [{ data: locationsData }, { data: branchesData }, { data: customersData }] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("branches").select("id, name, location_id").order("name"),
    supabase
      .from("customers")
      .select("phone_number, name, first_seen, branch:branches(id, name, location:locations(id, name))")
      .order("first_seen", { ascending: false }),
  ]);

  const locations = (locationsData ?? []) as Location[];
  const branches = (branchesData ?? []) as Branch[];
  const rawCustomers = (customersData ?? []) as unknown as RawCustomer[];

  const leads: LeadRow[] = rawCustomers.map((c) => ({
    phone_number: c.phone_number,
    name: c.name,
    first_seen: c.first_seen,
    branch_id: c.branch?.id ?? null,
    branch_name: c.branch?.name ?? null,
    location_id: c.branch?.location?.id ?? null,
    location_name: c.branch?.location?.name ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Filter captured leads by branch and launch a WhatsApp campaign."
      />
      <LeadsTable leads={leads} locations={locations} branches={branches} />
    </div>
  );
}
