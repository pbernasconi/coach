/**
 * User Profile Page
 * Allows users to view and edit their profile
 */

'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Clock, Calendar } from 'lucide-react';
import Image from 'next/image';

export default function ProfilePage() {
  const { user: clerkUser } = useUser();
  const { data: user, isLoading } = trpc.auth.getProfile.useQuery();
  const syncMutation = trpc.auth.syncFromClerk.useMutation();
  const updateMutation = trpc.auth.updateProfile.useMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    firstName: '',
    lastName: '',
    timezone: '',
  });

  const handleEdit = () => {
    if (user) {
      setEditValues({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        timezone: user.timezone || 'UTC',
      });
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(editValues);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to sync profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-lg">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your account details and preferences</CardDescription>
            </div>
            {!isEditing && (
              <Button onClick={handleEdit} variant="outline">
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-center gap-4">
            {clerkUser?.imageUrl && (
              <Image
                src={clerkUser.imageUrl}
                alt={user?.fullName || 'Profile'}
                className="h-20 w-20 rounded-full"
                width={80}
                height={80}
              />
            )}
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">
                {user?.fullName || 'User'}
              </h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          {/* Profile Fields */}
          <div className="space-y-4">
            {/* First Name */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">First Name</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editValues.firstName}
                    onChange={(e) =>
                      setEditValues({ ...editValues, firstName: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 border border-input rounded-md"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user?.firstName || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            {/* Last Name */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Last Name</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editValues.lastName}
                    onChange={(e) =>
                      setEditValues({ ...editValues, lastName: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 border border-input rounded-md"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user?.lastName || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Timezone */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Timezone</p>
                {isEditing ? (
                  <select
                    value={editValues.timezone}
                    onChange={(e) =>
                      setEditValues({ ...editValues, timezone: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 border border-input rounded-md"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user?.timezone || 'UTC'}
                  </p>
                )}
              </div>
            </div>

            {/* Account Created */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-sm text-muted-foreground">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <>
              <Separator />
              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Profile</CardTitle>
          <CardDescription>
            Sync your profile data from Clerk to the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            variant="secondary"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync from Clerk'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
