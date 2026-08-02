import { createClient } from "@/lib/supabase/server";
import CampaignsTabs from "@/components/dashboard/CampaignsTabs";
import PageHeader from "@/components/dashboard/ui/PageHeader";
import type { CampaignListItem, Template } from "@/lib/types";

interface RawCampaign {
  id: number;
  created_at: string;
  branch: { name: string } | null;
  template: { name: string } | null;
}

export default async function CampaignsPage() {
  const supabase = await createClient();

  const [{ data: templatesData }, { data: campaignsData }, { data: sendsData }] = await Promise.all([
    supabase.from("templates").select("*").order("created_at", { ascending: false }),
    supabase
      .from("campaigns")
      .select("id, created_at, branch:branches(name), template:templates(name)")
      .order("created_at", { ascending: false }),
    supabase.from("campaign_sends").select("campaign_id"),
  ]);

  const recipientCounts = new Map<number, number>();
  for (const row of sendsData ?? []) {
    recipientCounts.set(row.campaign_id, (recipientCounts.get(row.campaign_id) ?? 0) + 1);
  }

  const templates = (templatesData ?? []) as Template[];
  const campaigns: CampaignListItem[] = ((campaignsData ?? []) as unknown as RawCampaign[]).map((c) => ({
    id: c.id,
    created_at: c.created_at,
    branch_name: c.branch?.name ?? null,
    template_name: c.template?.name ?? null,
    total_recipients: recipientCounts.get(c.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Manage WhatsApp templates and review send performance."
      />
      <CampaignsTabs templates={templates} campaigns={campaigns} />
    </div>
  );
}
