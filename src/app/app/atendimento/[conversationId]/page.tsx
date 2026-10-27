"use client";

import { use } from "react";
import { Guard } from "@/components/guard";
import { Inbox } from "@/modules/inbox/inbox";

export default function ConversaPage({ params }: PageProps<"/app/atendimento/[conversationId]">) {
  const { conversationId } = use(params);
  return (
    <Guard area="atendimento">
      <Inbox conversationId={conversationId} />
    </Guard>
  );
}
