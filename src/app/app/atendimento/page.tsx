"use client";

import { Guard } from "@/components/guard";
import { Inbox } from "@/modules/inbox/inbox";

export default function AtendimentoPage() {
  return (
    <Guard area="atendimento">
      <Inbox />
    </Guard>
  );
}
