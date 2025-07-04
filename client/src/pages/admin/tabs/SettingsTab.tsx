import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSection } from "../pages/settings/ProfileSection";
import { AccountSection } from "../pages/settings/AccountSection";
import { PreferencesSection } from "../pages/settings/PreferencesSection";
import { SecuritySection } from "../pages/settings/SecuritySection";
import { User, Settings, Shield, Bell } from "lucide-react";

export const SettingsTab = () => {
  return (
    <div className="space-y-6">
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Settings</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 rounded-md">
            <TabsTrigger value="profile" className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Settings className="w-4 h-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Bell className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSection />
          </TabsContent>

          <TabsContent value="account">
            <AccountSection />
          </TabsContent>

          <TabsContent value="preferences">
            <PreferencesSection />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
