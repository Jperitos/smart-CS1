// app/(tabs)/home.tsx
import React, { useCallback } from "react";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useRealTimeData } from "../../contexts/RealTimeDataContext";
import { ProgressBar } from "react-native-paper";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import axiosInstance from "../../utils/axiosInstance";
import { useAccount } from "../../contexts/AccountContext";
import PickupWorkflowModal from "@/components/PickupWorkflowModal";
import { safeTextRenderers } from "../../utils/textErrorHandler";

export default function HomeScreen() {
  const router = useRouter();
  const { wasteBins, loading, error, isGPSValid, getSafeCoordinates } = useRealTimeData();
  const { account, loading: accountLoading } = useAccount();

  // Pickup modal state - MOVED TO TOP to avoid hooks after early return
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [alertedBins, setAlertedBins] = useState<Set<string>>(new Set());

  // Activity logs from backend - MOVED TO TOP to avoid hooks after early return
  // Initialize with empty array and ensure it's never undefined
  const [logs, setLogs] = useState<any[]>([]);

  // Get bin1 data - MOVED TO TOP to avoid issues with alertBin
  const centralPlazaRealTimeBins = (wasteBins || []).filter(
    (bin) => bin && bin.location && bin.location.toLowerCase().includes("central") && typeof bin.level === "number"
  );
  const bin1 = centralPlazaRealTimeBins.find((bin) => bin.id === "bin1");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!accountLoading && !account) {
      console.log(" Mobile App - Not authenticated, redirecting to login");
      router.replace("/(auth)/login");
    }
  }, [account, accountLoading]);

  // Fetch activity logs function - MEMOIZED to prevent infinite re-renders
  const fetchActivityLogs = useCallback(async () => {
    if (!account?.id) return;

    try {
      console.log("📱 Mobile App - Fetching activity logs for user:", account.email, "ID:", account.id);

      // Get all activity logs from the server
      const response = await axiosInstance.get('/api/activitylogs');
      console.log("📱 Mobile App - Raw API response:", response.data);
      
      const allActivities = response.data?.activities || [];
      console.log("📱 Mobile App - Extracted activities:", allActivities);
      
      console.log("📱 Mobile App - Total activities from server:", allActivities.length);
      
      // Filter activities based on status and assignment
      const filteredActivities = allActivities.filter((activity: any) => {
        // Show all pending tasks to all janitors (no assigned janitor)
        if (activity.status === 'pending' && !activity.assigned_janitor_id) {
          console.log("📱 Mobile App - Including pending task:", activity.id, "for all janitors");
          return true;
        }
        
        // Show in-progress and done tasks only to assigned janitor
        if ((activity.status === 'in_progress' || activity.status === 'done') && 
            activity.assigned_janitor_id === account.id) {
          console.log("📱 Mobile App - Including assigned task:", activity.id, "for user:", account.id);
          return true;
        }
        
        return false;
      });
      
      console.log("📱 Mobile App - Filtered activities count:", filteredActivities.length);
      
      // Debug: Log all activities for analysis (only in development)
      if (__DEV__ && allActivities.length > 0) {
        console.log(`📱 Mobile App - All ${allActivities.length} activities:`, 
          allActivities.map((activity: any) => ({
            id: activity.id,
            bin_id: activity.bin_id,
            status: activity.status,
            assigned_janitor_id: activity.assigned_janitor_id,
          }))
        );
      }

      // Update state with filtered activities (only show relevant ones)
      // Ensure we never set logs to undefined - double safety check
      const safeFilteredActivities = Array.isArray(filteredActivities) ? filteredActivities : [];
      setLogs(safeFilteredActivities);

      console.log(`📱 Mobile App - Found ${filteredActivities.length} filtered activity logs for ${account.email}`);
    } catch (err) {
      console.error("📱 Mobile App - Failed to fetch activity logs:", err);
      setLogs([]);
    }
  }, [account?.id, account?.email]);

  // Fetch activity logs on component mount
  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  // Refresh activity logs when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      console.log("📱 Mobile App - Screen focused, refreshing activity logs...");
      if (account?.id) {
        fetchActivityLogs();
      }
    }, [fetchActivityLogs, account?.id])
  );

  // Bin alert effect - FIXED to prevent infinite loops
  useEffect(() => {
    // Only run this effect after authentication is loaded
    if (accountLoading) return;

    // Debug logging only in development
    if (__DEV__) {
      console.log("🔍 DEBUG - Checking bin alert logic:");
      console.log("🔍 DEBUG - wasteBins:", wasteBins);
      console.log("🔍 DEBUG - wasteBins length:", wasteBins?.length);
      console.log("🔍 DEBUG - centralPlazaRealTimeBins:", centralPlazaRealTimeBins);
      console.log("🔍 DEBUG - bin1 found:", bin1);
      console.log("🔍 DEBUG - bin1 level:", bin1?.level);
      console.log("🔍 DEBUG - bin1 binData:", bin1?.binData);
      console.log("🔍 DEBUG - alertedBins:", Array.from(alertedBins));
      console.log("🔍 DEBUG - pickupModalVisible:", pickupModalVisible);
    }

    if (!bin1 || typeof bin1.level !== "number") {
      if (__DEV__) {
        console.log("🔍 DEBUG - No valid bin1 found or level not a number");
      }
      return;
    }

    // Don't show alert if modal is already visible
    if (pickupModalVisible) {
      if (__DEV__) {
        console.log("🔍 DEBUG - Pickup modal already visible, skipping alert logic");
      }
      return;
    }

    // Use functional state updates to avoid dependency on alertedBins
    if (bin1.level >= 85) {
      setAlertedBins((prev) => {
        if (!prev.has("bin1")) {
          if (__DEV__) {
            console.log(`🚨 BIN1 CRITICAL: ${bin1.level}% - SHOWING PICKUP WORKFLOW MODAL`);
          }
          setPickupModalVisible(true);
          return new Set([...prev, "bin1"]);
        }
        return prev;
      });
    } else if (bin1.level < 85) {
      setAlertedBins((prev) => {
        if (prev.has("bin1")) {
          if (__DEV__) {
            console.log(`🔍 DEBUG - Bin1 level ${bin1.level}% is below 85%, removing from alerted bins`);
          }
          const newSet = new Set(prev);
          newSet.delete("bin1");
          return newSet;
        }
        return prev;
      });
    } else {
      if (__DEV__) {
        console.log(`🔍 DEBUG - Bin1 level ${bin1.level}%, already alerted: ${alertedBins.has("bin1")}`);
      }
    }
  }, [accountLoading, wasteBins, bin1, pickupModalVisible]); // REMOVED alertedBins from dependencies

  // Show loading while checking authentication
  if (accountLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Checking authentication...</Text>
      </View>
    );
  }

  // Static locations (except Central Plaza, which is real-time)
  const staticLocations = [
    { id: "central-plaza", name: "Central Plaza" },
    { id: "park-avenue", name: "Park Avenue", bins: [30, 40, 55, 60], lastCollected: "1 day ago" },
    { id: "mall-district", name: "Mall District", bins: [90, 95, 85, 100], lastCollected: "4 hours ago" },
    { id: "residential-area", name: "Residential Area", bins: [45, 60, 50, 70], lastCollected: "6 hours ago" },
  ];

  // Central Plaza - 1 real-time bin + 3 static bins (centralPlazaRealTimeBins already defined at top)

  // Static bins for Central Plaza (3 additional bins)
  const centralPlazaStaticBins = [
    { level: 45, lastCollected: "2 hours ago", id: "central-static-1" },
    { level: 78, lastCollected: "1 hour ago", id: "central-static-2" },
    { level: 32, lastCollected: "3 hours ago", id: "central-static-3" },
  ];

  // Combine real-time and static bins
  const allCentralPlazaBins = [...centralPlazaRealTimeBins, ...centralPlazaStaticBins];

  const centralPlazaLevels = allCentralPlazaBins
    .filter((bin) => bin && typeof bin.level === "number")
    .map((bin) => bin.level);
  const centralPlazaAvg =
    Array.isArray(centralPlazaLevels) && centralPlazaLevels.length > 0 ? centralPlazaLevels.reduce((s, v) => s + v, 0) / centralPlazaLevels.length : 0;
  const centralPlazaNearlyFull = Array.isArray(centralPlazaLevels) ? centralPlazaLevels.filter((v) => v >= 80).length : 0;
  const centralPlazaLastCollected = Array.isArray(allCentralPlazaBins) && allCentralPlazaBins.length > 0 ? allCentralPlazaBins[0].lastCollected : "Unknown";

  // Pickup modal handler
  const handlePickupRequest = () => {
    setPickupModalVisible(true);
  };

  // Pickup modal handlers
  const handlePickupConfirm = () => {
    setPickupModalVisible(false);
    // Reset the alerted bins when pickup is completed
    setAlertedBins((prev) => {
      const newSet = new Set(prev);
      newSet.delete("bin1");
      return newSet;
    });
    // Additional logic for pickup confirmation can be added here
  };

  const handleAcknowledge = () => {
    setPickupModalVisible(false);
    // Don't reset alerted bins when modal is closed without completion
    // This allows the alert to show again if bin level is still high
    // Additional logic for acknowledgment can be added here
  };

  // Get bin1 for alerts - bin1 is already defined at the top
  const alertBin = bin1;

  // Map backend fields to UI-expected fields - SAFE: Check if logs exists before mapping
  const mappedLogs = (logs || []).map((log) => ({
    ...log,
    type: log.activity_type || "task_assignment",
    message: log.task_note && log.task_note.trim() !== "" ? log.task_note : `Task for bin ${log.bin_id}`,
    bin: log.bin_id,
    location: log.bin_location,
    time: log.time,
    date: log.date,
    // Apply proper status logic: completed > in_progress > pending
    status: (() => {
      const hasProof = log.status === "done" || log.completed_at || log.proof_image || (log.photos && log.photos.length > 0);
      const hasJanitor = log.assigned_janitor_id;

      // Debug logging only in development
      if (__DEV__) {
        console.log("🔍 Homepage Status Debug:", {
          bin_id: log.bin_id,
          original_status: log.status,
          assigned_janitor_id: log.assigned_janitor_id,
          hasProof,
          hasJanitor,
          completed_at: log.completed_at,
          proof_image: log.proof_image,
          photos_length: log.photos?.length || 0,
        });
      }

      if (hasProof) {
        if (__DEV__) {
          console.log("✅ Status: done (has proof)");
        }
        return "done"; // Task is completed (has proof)
      } else if (hasJanitor) {
        if (__DEV__) {
          console.log("🔄 Status: in_progress (janitor assigned)");
        }
        return "in_progress"; // Janitor assigned but not completed
      } else {
        if (__DEV__) {
          console.log("⏳ Status: pending (no janitor)");
        }
        return "pending"; // No janitor assigned
      }
    })(),
  }));

  // Filter and sort activity logs
  const filteredAndSortedLogs = mappedLogs
    .filter((log) => {
      // Show pending tasks to all janitors (unassigned)
      if (log.status === "pending" && !log.assigned_janitor_id) {
        // Debug logging removed to prevent infinite loops
        return true;
      }
      
      // Show in_progress tasks only to assigned janitor
      if (log.status === "in_progress" && log.assigned_janitor_id === account?.id) {
        // Debug logging removed to prevent infinite loops
        return true;
      }
      
      // Debug logging removed to prevent infinite loops
      return false;
    }) // Only show pending (unassigned) and in_progress (assigned to me)
    .sort((a, b) => {
      // First sort by status: pending first, then in_progress
      if (a.status !== b.status) {
        if (a.status === "pending" && b.status === "in_progress") return -1;
        if (a.status === "in_progress" && b.status === "pending") return 1;
      }

      // Then sort by date: most recent first
      const dateA = new Date(a.created_at || a.timestamp || 0);
      const dateB = new Date(b.created_at || b.timestamp || 0);
      return dateB.getTime() - dateA.getTime();
    });

  // Only log when data actually changes to prevent infinite logging
  useEffect(() => {
    if (__DEV__ && Array.isArray(filteredAndSortedLogs) && filteredAndSortedLogs.length > 0) {
      console.log("📊 Homepage Filtered Logs:", {
        total: Array.isArray(mappedLogs) ? mappedLogs.length : 0,
        filtered: filteredAndSortedLogs.length,
        logs: filteredAndSortedLogs.map((log) => ({
          bin_id: log.bin_id,
          status: log.status,
          assigned_janitor_id: log.assigned_janitor_id,
        })),
      });
    }
  }, [mappedLogs.length, filteredAndSortedLogs.length]);

  const getStatusColor = (val: number) => {
    if (val >= 90) return "#f44336";
    if (val >= 60) return "#ff9800";
    return "#4caf50";
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "login":
        return styles.badgeLogin;
      case "pickup":
        return styles.badgePickup;
      case "emptied":
        return styles.badgeEmptied;
      case "error":
        return styles.badgeError;
      default:
        return styles.badgeDefault;
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
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.header}>
          <Header />
        </View>

        {/* GPS Status Indicator */}
        {!isGPSValid() && (
          <View style={styles.gpsStatusContainer}>
            <Text style={styles.gpsStatusText}>🛰️ GPS Not Connected</Text>
            <Text style={styles.gpsStatusSubText}>Real-time bin locations will appear when GPS is available</Text>
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
          <ProgressBar
            progress={centralPlazaAvg / 100}
            color={getStatusColor(centralPlazaAvg)}
            style={styles.progress}
          />
          <Text style={styles.subText}>
            Nearly full bins: {centralPlazaNearlyFull} / {Array.isArray(centralPlazaLevels) ? centralPlazaLevels.length : 0}
          </Text>
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
                  <Text style={styles.badgeText}>{avg >= 90 ? "critical" : avg >= 60 ? "warning" : "normal"}</Text>
                </View>
              </View>
              <Text style={styles.percentText}>{Math.round(avg)}%</Text>
              <ProgressBar progress={avg / 100} color={getStatusColor(avg)} style={styles.progress} />
              <Text style={styles.subText}>
                Nearly full bins: {nearlyFull} / {bins.length}
              </Text>
              <Text style={styles.subText}>Last collected: {lastCollected}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.activityHeader}>
          <View style={styles.activityTitleRow}>
            <Text style={styles.sectionTitle}>Activity Logs</Text>
            <TouchableOpacity
              onPress={() => {
                // Use the memoized fetchActivityLogs function
                fetchActivityLogs();
              }}
              style={styles.refreshButton}
            >
              <Ionicons name="refresh" size={20} color="#2e7d32" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push("/home/activity-logs")}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {filteredAndSortedLogs.slice(0, 3).map((log, i) => (
          <TouchableOpacity
            key={i}
            onPress={() =>
              router.push({
                pathname: "/home/activity-details",
                params: {
                  binId: log.bin ?? "N/A",
                  activityLog: JSON.stringify(log),
                  isReadOnly: log.status === "done" ? "true" : "false",
                },
              })
            }
          >
            <View style={styles.logCard}>
              {/* Title row with status and type badges */}
              <View style={styles.logTitleRow}>
                <Text style={styles.logTitle}>{safeTextRenderers.binTitle(log.bin)}</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.badgeContainer}>
                  <View style={[styles.statusBadge, getStatusBadgeStyle(log.status)]}>
                    <Ionicons
                      name={getStatusIcon(log.status) as any}
                      size={12}
                      color="#fff"
                      style={styles.statusIcon}
                    />
                    <Text style={styles.statusText}>{safeTextRenderers.statusText(log.status)}</Text>
                  </View>
                  <View style={[styles.typeBadge, getBadgeStyle(log.type)]}>
                    <Text style={styles.badgeText}>{safeTextRenderers.typeText(log.type)}</Text>
                  </View>
                </View>
              </View>

              {/* Message */}
              <View style={styles.logMsgRow}>
                <Text style={styles.logMessage}>{safeTextRenderers.messageText(log.message)}</Text>
              </View>

              {/* Location and Time details */}
              <View style={styles.logDetailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={14} color="#666" />
                  <Text style={styles.logSubtext}>{safeTextRenderers.locationText(log.location)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.logTime}>{safeTextRenderers.timeText(log.date, log.time)}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pickup Workflow Modal */}
      <PickupWorkflowModal
        visible={pickupModalVisible}
        onClose={handleAcknowledge}
        binData={alertBin}
        onPickupComplete={handlePickupConfirm}
        onAcknowledge={handleAcknowledge}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 16, marginBottom: 90 },
  header: { marginTop: 44, marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "600", marginBottom: 15, color: "#000" },

  // Location cards
  locationCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    elevation: 2,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  locationName: { fontSize: 16, fontWeight: "600", color: "#333" },
  percentText: { fontSize: 22, fontWeight: "700", color: "#000", marginTop: 8 },
  progress: { height: 6, borderRadius: 6, marginVertical: 6 },
  subText: { fontSize: 12, color: "#555" },

  // Logs
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 20,
  },
  activityTitleRow: { flexDirection: "row", alignItems: "center" },
  refreshButton: {
    marginLeft: 10,
    padding: 5,
    borderRadius: 15,
    backgroundColor: "#f0f8f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  seeAllText: { color: "#2e7d32", fontWeight: "500", fontSize: 13, marginTop: 2 },
  logCard: {
    flexDirection: "column",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  logTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  logMsgRow: {
    marginBottom: 8,
  },
  logMessage: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  logLocTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  logTime: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },
  logSubtext: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusIcon: {
    marginRight: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#fff",
  },
  statusDone: {
    backgroundColor: "#4CAF50",
  },
  statusInProgress: {
    backgroundColor: "#FF9800",
  },
  statusCancelled: {
    backgroundColor: "#F44336",
  },
  statusPending: {
    backgroundColor: "#9E9E9E",
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
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginBottom: 8,
  },
  gpsStatusText: {
    color: "#d97706",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  gpsStatusSubText: {
    color: "#92400e",
    fontSize: 12,
    lineHeight: 16,
  },
});
