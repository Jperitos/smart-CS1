// app/(tabs)/home.tsx
import React from "react";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from '@expo/vector-icons';

import { useRealTimeData } from "../../hooks/useRealTimeData";
import { ProgressBar } from "react-native-paper";
import { useRouter } from "expo-router";
import axiosInstance from "../../utils/axiosInstance";
import { useAccount } from "../../hooks/useAccount";

export default function HomeScreen() {
  const router = useRouter();
  const { wasteBins, loading, error, isGPSValid } = useRealTimeData();
  const { account } = useAccount();

  // Static locations (except Central Plaza, which is real-time)
  const staticLocations = [
    { id: "central-plaza", name: "Central Plaza" },
    { id: "park-avenue", name: "Park Avenue", bins: [30, 40, 55, 60], lastCollected: "1 day ago" },
    { id: "mall-district", name: "Mall District", bins: [90, 95, 85, 100], lastCollected: "4 hours ago" },
    { id: "residential-area", name: "Residential Area", bins: [45, 60, 50, 70], lastCollected: "6 hours ago" },
  ];

  // Central Plaza - 1 real-time bin + 3 static bins
  const centralPlazaRealTimeBins = wasteBins.filter((bin) => 
    bin.location && bin.location.toLowerCase().includes("central")
  );
  
  // Static bins for Central Plaza (3 additional bins)
  const centralPlazaStaticBins = [
    { level: 45, lastCollected: "2 hours ago", id: "central-static-1" },
    { level: 78, lastCollected: "1 hour ago", id: "central-static-2" },
    { level: 32, lastCollected: "3 hours ago", id: "central-static-3" }
  ];
  
  // Combine real-time and static bins
  const allCentralPlazaBins = [
    ...centralPlazaRealTimeBins,
    ...centralPlazaStaticBins
  ];
  
  const centralPlazaLevels = allCentralPlazaBins.map((bin) => bin.level);
  const centralPlazaAvg = centralPlazaLevels.length > 0 ? centralPlazaLevels.reduce((s, v) => s + v, 0) / centralPlazaLevels.length : 0;
  const centralPlazaNearlyFull = centralPlazaLevels.filter((v) => v >= 80).length;
  const centralPlazaLastCollected = allCentralPlazaBins.length > 0 ? allCentralPlazaBins[0].lastCollected : "Unknown";

  // Activity logs from backend
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    const fetchActivityLogs = async () => {
      if (!account?.id) return;

      try {
        console.log('📱 Mobile App - Fetching activity logs for user:', account.email, 'ID:', account.id);
        
        // Try multiple endpoints to get user's activity logs
        let response;
        try {
          // First try: Get logs assigned to this user (as janitor)
          response = await axiosInstance.get(`/api/activitylogs/assigned/${account.id}`);
          console.log('📱 Mobile App - Got assigned logs:', response.data);
        } catch (assignedErr) {
          console.log('📱 Mobile App - No assigned logs, trying user logs...');
          // Second try: Get logs created by this user
          response = await axiosInstance.get(`/api/activitylogs/${account.id}`);
          console.log('📱 Mobile App - Got user logs:', response.data);
        }

        const activities = response.data.activities || response.data.activities || [];
        setLogs(activities);
        
        console.log(`📱 Mobile App - Found ${activities.length} activity logs for ${account.email}`);
      } catch (err: any) {
        console.error("📱 Mobile App - Failed to fetch activity logs:", err);
        setLogs([]);
      }
    };

    fetchActivityLogs();
  }, [account?.id, account?.email]);

  // Map backend fields to UI-expected fields
  const mappedLogs = logs.map((log) => ({
    ...log,
    type: log.activity_type || "task_assignment",
    message:
      log.task_note && log.task_note.trim() !== ""
        ? log.task_note
        : `Task for bin ${log.bin_id}`,
    bin: log.bin_id,
    location: log.bin_location,
    time: log.time,
    date: log.date,
  }));

  const getStatusColor = (val: number) => {
    if (val >= 90) return "#f44336";
    if (val >= 60) return "#ff9800";
    return "#4caf50";
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "login": return styles.badgeLogin;
      case "pickup": return styles.badgePickup;
      case "emptied": return styles.badgeEmptied;
      case "error": return styles.badgeError;
      default: return styles.badgeDefault;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "done":
        return styles.statusDone;
      case "in_progress":
        return styles.statusInProgress;
      case "cancelled":
        return styles.statusCancelled;
      case "pending":
      default:
        return styles.statusPending;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return "checkmark-circle";
      case "in_progress":
        return "time";
      case "cancelled":
        return "close-circle";
      case "pending":
      default:
        return "hourglass";
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={styles.header}><Header /></View>
      
      {/* GPS Status Indicator */}
      {!isGPSValid() && (
        <View style={styles.gpsStatusContainer}>
          <Text style={styles.gpsStatusText}>🛰️ GPS Not Connected</Text>
          <Text style={styles.gpsStatusSubText}>
            Real-time bin locations will appear when GPS is available
          </Text>
        </View>
      )}
      
      <Text style={styles.sectionTitle}>Bin Locations</Text>
      {/* Central Plaza (real-time) */}
      <TouchableOpacity
        key="central-plaza"
        style={styles.locationCard}
        onPress={() =>
          router.push({
            pathname: "/home/binlocation",
            params: { id: "central-plaza" },
          })
        }
      >
        <View style={styles.topRow}>
          <Text style={styles.locationName}>Central Plaza</Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(centralPlazaAvg) }]}> 
              <Text style={styles.badgeText}>
                {centralPlazaAvg >= 90 ? "critical" : centralPlazaAvg >= 60 ? "warning" : "normal"}
              </Text>
            </View>
            {!isGPSValid() && (
              <View style={[styles.statusBadge, { backgroundColor: "#f44336" }]}>
                <Text style={styles.badgeText}>GPS Offline</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.percentText}>{Math.round(centralPlazaAvg)}%</Text>
        <ProgressBar progress={centralPlazaAvg / 100} color={getStatusColor(centralPlazaAvg)} style={styles.progress} />
        <Text style={styles.subText}>Nearly full bins: {centralPlazaNearlyFull} / {centralPlazaLevels.length}</Text>
        <Text style={styles.subText}>Last collected: {centralPlazaLastCollected}</Text>
      </TouchableOpacity>

      {/* Other locations (static) */}
      {staticLocations.slice(1).map((loc) => {
        // Robust checks for missing bins and lastCollected
        const bins = Array.isArray(loc.bins) ? loc.bins : [];
        const avg = bins.length > 0 ? bins.reduce((s, v) => s + v, 0) / bins.length : 0;
        const nearlyFull = bins.filter((v) => v >= 80).length;
        const lastCollected = typeof loc.lastCollected === "string" ? loc.lastCollected : "Unknown";
        return (
          <TouchableOpacity
            key={loc.id}
            style={styles.locationCard}
            onPress={() =>
              router.push({
                pathname: "/home/binlocation",
                params: { id: loc.id },
              })
            }
          >
            <View style={styles.topRow}>
              <Text style={styles.locationName}>{loc.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(avg) }]}> 
                <Text style={styles.badgeText}>
                  {avg >= 90 ? "critical" : avg >= 60 ? "warning" : "normal"}
                </Text>
              </View>
            </View>
            <Text style={styles.percentText}>{Math.round(avg)}%</Text>
            <ProgressBar progress={avg / 100} color={getStatusColor(avg)} style={styles.progress} />
            <Text style={styles.subText}>Nearly full bins: {nearlyFull} / {bins.length}</Text>
            <Text style={styles.subText}>Last collected: {lastCollected}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.activityHeader}>
        <Text style={styles.sectionTitle}>Activity Logs</Text>
        <TouchableOpacity onPress={() => router.push("/home/activity-logs")}> 
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
  {mappedLogs.slice(0, 3).map((log, i) => (
        <TouchableOpacity
          key={i}
          onPress={() =>
            router.push({
              pathname: "/home/proof-of-pickup",
              params: { binId: log.bin ?? "N/A" },
            })
          }
        >
          <View style={styles.logCard}>
            {/* Title row with status and type badges */}
            <View style={styles.logTitleRow}>
              <Text style={styles.logTitle}>{`Bin ${log.bin}`}</Text>
              <View style={{ flex: 1 }} />
              <View style={styles.badgeContainer}>
                <View style={[styles.statusBadge, getStatusBadgeStyle(log.status)]}>
                  <Ionicons 
                    name={getStatusIcon(log.status) as any} 
                    size={12} 
                    color="#fff" 
                    style={styles.statusIcon}
                  />
                  <Text style={styles.statusText}>{log.status.toUpperCase()}</Text>
                </View>
                <View style={[styles.typeBadge, getBadgeStyle(log.type)]}>
                  <Text style={styles.badgeText}>{String(log.type)}</Text>
                </View>
              </View>
            </View>

            {/* Message */}
            <View style={styles.logMsgRow}>
              <Text style={styles.logMessage}>{String(log.message)}</Text>
            </View>

            {/* Location and Time details */}
            <View style={styles.logDetailsRow}>
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.logSubtext}>{log.location || "Unknown Location"}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.logTime}>{`${log.date} ${log.time}`}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 16, marginBottom: 90 },
  header: { marginTop: 44, marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "600", marginBottom: 15, color: "#000" },

  // Location cards
  locationCard: { backgroundColor: "#fafafa", borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#ddd", elevation: 2 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  locationName: { fontSize: 16, fontWeight: "600", color: "#333" },
  percentText: { fontSize: 22, fontWeight: "700", color: "#000", marginTop: 8 },
  progress: { height: 6, borderRadius: 6, marginVertical: 6 },
  subText: { fontSize: 12, color: "#555" },

  // Logs
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 20 },
  seeAllText: { color: "#2e7d32", fontWeight: "500", fontSize: 13, marginTop: 2 },
  logCard: { 
    flexDirection: "column", 
    borderRadius: 10, 
    padding: 14, 
    marginBottom: 12, 
    backgroundColor: "#fafafa", 
    borderWidth: 1, 
    borderColor: "#ddd" 
  },
  logTitleRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 8 
  },
  logTitle: { 
    fontSize: 16, 
    fontWeight: "bold", 
    color: "#333", 
    marginBottom: 2 
  },
  logMsgRow: { 
    marginBottom: 8 
  },
  logMessage: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "#333" 
  },
  logLocTimeRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 2 
  },
  logTime: { 
    fontSize: 12, 
    color: "#777", 
    marginTop: 4 
  },
  logSubtext: { 
    fontSize: 13, 
    color: "#555", 
    marginTop: 4 
  },

  // Badges
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "center" },
  badgeLogin: { backgroundColor: "#64b5f6" },
  badgePickup: { backgroundColor: "#ffd54f" },
  badgeEmptied: { backgroundColor: "#81c784" },
  badgeError: { backgroundColor: "#f44336" },
  badgeDefault: { backgroundColor: "#9e9e9e" },
  badgeText: { fontSize: 11, fontWeight: "bold", color: "#fff", textTransform: "uppercase" },

  // Badge container
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  // Status indicator styles
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusIcon: {
    marginRight: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusDone: {
    backgroundColor: '#4CAF50',
  },
  statusInProgress: {
    backgroundColor: '#FF9800',
  },
  statusCancelled: {
    backgroundColor: '#F44336',
  },
  statusPending: {
    backgroundColor: '#9E9E9E',
  },

  // Details row styles
  logDetailsRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginBottom: 8,
    paddingVertical: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  // GPS Status styles
  gpsStatusContainer: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginBottom: 8,
  },
  gpsStatusText: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  gpsStatusSubText: {
    color: '#92400e',
    fontSize: 12,
    lineHeight: 16,
  },
});
