export interface Location {
  id: number;
  name: string;
}

export interface Branch {
  id: number;
  name: string;
  location_id: number;
}

export interface LeadRow {
  phone_number: string;
  name: string | null;
  first_seen: string;
  branch_id: number | null;
  branch_name: string | null;
  location_id: number | null;
  location_name: string | null;
}

export interface Template {
  id: number;
  name: string;
  meta_template_id: string | null;
  status: "pending" | "approved" | "rejected";
  body: string | null;
  category: "marketing" | "utility" | null;
  language: string;
  created_at: string;
}

export interface CampaignListItem {
  id: number;
  created_at: string;
  branch_name: string | null;
  template_name: string | null;
  total_recipients: number;
}
