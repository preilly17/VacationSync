import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Users, Crown, User, Calendar, Mail, Smartphone } from "lucide-react";
import type { TripWithDetails } from "@shared/schema";

interface MemberListProps {
  trip: TripWithDetails;
}

export function MemberList({ trip }: MemberListProps) {
  const [showAllMembers, setShowAllMembers] = useState(false);

  const displayedMembers = showAllMembers ? trip.members : trip.members.slice(0, 5);
  const hasMoreMembers = trip.members.length > 5;

  return (
    <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Trip Members</h3>
            <Badge variant="secondary" className="ml-2">
              {trip.memberCount}
            </Badge>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                View All Members
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Trip Members
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {trip.members.map((member, index) => (
                  <div key={member.user.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {member.user.firstName?.[0] || member.user.email?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          {member.user.id === trip.createdBy && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                          {member.role === 'organizer' && member.user.id !== trip.createdBy && (
                            <Badge variant="secondary" className="text-xs">
                              Organizer
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail className="w-3 h-3" />
                            {member.user.email}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {member.user.cashAppUsername && (
                            <Badge variant="outline" className="text-xs">
                              <Smartphone className="w-3 h-3 mr-1" />
                              ${member.user.cashAppUsername}
                            </Badge>
                          )}
                          {member.user.venmoUsername && (
                            <Badge variant="outline" className="text-xs">
                              <Smartphone className="w-3 h-3 mr-1" />
                              @{member.user.venmoUsername}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {index < trip.members.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {displayedMembers.map((member) => (
            <div 
              key={member.user.id} 
              className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={member.user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {member.user.firstName?.[0] || member.user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {member.user.firstName} {member.user.lastName}
              </span>
              {member.user.id === trip.createdBy && (
                <Crown className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          ))}
          
          {hasMoreMembers && !showAllMembers && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAllMembers(true)}
              className="rounded-full px-3 py-2 h-auto text-sm"
            >
              +{trip.members.length - 5} more
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}