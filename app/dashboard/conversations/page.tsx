import EmptyState from "@/components/dashboard/ui/EmptyState";
import { ConversationsIcon } from "@/components/dashboard/icons";

export default function ConversationsIndexPage() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <EmptyState
        icon={<ConversationsIcon className="h-6 w-6" />}
        title="Select a conversation"
        description="Choose a customer from the list on the left to view their message thread."
      />
    </div>
  );
}
