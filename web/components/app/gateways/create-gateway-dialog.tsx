"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiClient } from "@/lib/api-client";
import type { Gateway, GatewayCredentials } from "@/lib/types";

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copié.");
          }}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

export function CreateGatewayDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (gateway: Gateway) => void;
}) {
  const { call } = useApiClient();
  const [name, setName] = useState("Gateway");
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(null);

  async function submit() {
    setSubmitting(true);
    try {
      const created = await call<GatewayCredentials>("/api/v1/gateways", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setCredentials(created);
      onCreated({
        gateway_id: created.gateway_id,
        name,
        status: "pending",
        last_seen_at: null,
      });
    } catch {
      toast.error("Impossible de créer le gateway.");
    } finally {
      setSubmitting(false);
    }
  }

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      setCredentials(null);
      setName("Gateway");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>Gateway créé</DialogTitle>
              <DialogDescription>
                Ce jeton de pairing et cette clé ne seront plus jamais
                affichés. Copiez-les dans la configuration de votre bundle
                détaché maintenant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <CopyField label="Pairing token" value={credentials.pairing_token} />
              <CopyField label="Gateway key" value={credentials.gateway_key} />
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Terminé</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Créer / relier un gateway</DialogTitle>
              <DialogDescription>
                Le jeton de pairing généré permet à votre bundle détaché de
                se relier à ce compte.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Annuler
              </Button>
              <Button onClick={submit} disabled={submitting || !name.trim()}>
                {submitting && <Loader2 className="animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
