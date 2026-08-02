import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-service";
import { getMetaTemplateStatus } from "@/lib/meta-templates";

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const id: number | undefined = payload?.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const service = createServiceClient();
  const { data: template } = await service
    .from("templates")
    .select("id, meta_template_id")
    .eq("id", id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!template.meta_template_id) {
    return NextResponse.json({ error: "Template has no Meta template id to check" }, { status: 400 });
  }

  const result = await getMetaTemplateStatus(template.meta_template_id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { data: updated, error: updateError } = await service
    .from("templates")
    .update({ status: result.status })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ template: updated });
}
