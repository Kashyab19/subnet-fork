'use client';

import { useState, useEffect } from 'react';
import type { Agent } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Loader2 } from 'lucide-react';
import { getShareUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ShareDialogProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (updatedAgent: Agent) => void;
}

export function ShareDialog({ agent, open, onOpenChange, onUpdate }: ShareDialogProps) {
  const [isPublic, setIsPublic] = useState(agent.isPublic || false);
  const [shareId, setShareId] = useState(agent.shareId || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsPublic(agent.isPublic || false);
    setShareId(agent.shareId || '');
  }, [agent]);

  const handleTogglePublic = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPublic: checked,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update sharing settings' }));
        throw new Error(error.error || 'Failed to update sharing settings');
      }

      const updatedAgent = await response.json();
      setIsPublic(updatedAgent.isPublic);
      setShareId(updatedAgent.shareId || '');
      onUpdate?.(updatedAgent);
      
      toast({
        title: checked ? 'Agent is now public' : 'Agent is now private',
        description: checked 
          ? updatedAgent.shareId 
            ? 'Your agent can now be discovered and shared' 
            : 'Failed to generate share ID. Please try again.'
          : 'Your agent is now private',
      });
    } catch (error: any) {
      console.error('Error updating sharing settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update sharing settings. Please try again.',
        variant: 'destructive',
      });
      setIsPublic(!checked); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareId) return;

    const url = getShareUrl(shareId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The shareable link has been copied to your clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  const shareUrl = shareId ? getShareUrl(shareId) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Agent</DialogTitle>
          <DialogDescription>
            Make your agent discoverable and shareable with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="public-toggle" className="text-base">
                Make agent public
              </Label>
              <p className="text-muted-foreground text-sm">
                Allow others to discover and fork your agent
              </p>
            </div>
            {isUpdating ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                id="public-toggle"
                checked={isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={isUpdating}
              />
            )}
          </div>

          {isPublic && shareId && (
            <div className="space-y-2">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Anyone with this link can view and fork your agent
              </p>
            </div>
          )}

          {!isPublic && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-muted-foreground text-sm">
                Your agent is private. Toggle the switch above to make it public and generate a
                shareable link.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

