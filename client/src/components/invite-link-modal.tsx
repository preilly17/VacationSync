import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Share2 } from "lucide-react";
import type { TripWithDetails } from "@shared/schema";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripWithDetails;
}

export function InviteLinkModal({ open, onOpenChange, trip }: InviteLinkModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/join/${trip.shareCode}`;
  const shareMessage = `Join my trip "${trip.name}" to ${trip.destination}! 🌍\n\nClick here to join: ${inviteUrl}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${trip.name}`,
          text: shareMessage,
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled sharing or error occurred
        console.log('Sharing cancelled');
      }
    } else {
      // Fallback to copying
      copyToClipboard(shareMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Share this link with others so they can join your trip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trip Info */}
          <div className="p-4 bg-neutral-50 rounded-lg">
            <h3 className="font-medium text-neutral-900">{trip.name}</h3>
            <p className="text-sm text-neutral-600">{trip.destination}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {trip.memberCount} member{trip.memberCount !== 1 ? 's' : ''} currently
            </p>
          </div>

          {/* Invite Link */}
          <div>
            <Label htmlFor="inviteLink">Invite Link</Label>
            <div className="flex mt-1">
              <Input
                id="inviteLink"
                value={inviteUrl}
                readOnly
                className="rounded-r-none"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-l-none px-3"
                onClick={() => copyToClipboard(inviteUrl)}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Share Message */}
          <div>
            <Label htmlFor="shareMessage">Message to Share</Label>
            <div className="flex mt-1">
              <textarea
                id="shareMessage"
                value={shareMessage}
                readOnly
                rows={3}
                className="flex-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-r-none resize-none"
              />
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-l-none rounded-b-none px-3 flex-1"
                  onClick={() => copyToClipboard(shareMessage)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-l-none rounded-t-none px-3 flex-1"
                  onClick={shareNative}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-neutral-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium text-blue-900 mb-1">How to share:</p>
            <ul className="text-blue-800 space-y-1">
              <li>• Copy the link and send via text, email, or chat</li>
              <li>• Use the share button to send through your device's sharing options</li>
              <li>• Copy the full message for a more inviting invite</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={shareNative}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Invite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}