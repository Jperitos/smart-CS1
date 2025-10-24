import { StaffMapSection } from "../pages/StaffMapSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Route, Save, Edit, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { useUpdateBin } from "@/hooks/useUpdateBin";
import { StaffMapSkeleton } from "@/components/skeletons/StaffMapSkeleton";
import { useState } from "react";
import { toast } from "sonner";

export function MapTab() {
  const { wasteBins, loading, error, bin1Data, dynamicBinLocations, refresh } = useRealTimeData();
  const { updateBin, isLoading: isUpdating, error: updateError } = useUpdateBin();

  // Form state for updating bin details
  const [binForm, setBinForm] = useState({
    binName: "",
    binType: "",
    mainLocation: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBinId, setSelectedBinId] = useState<string>("");
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState<boolean>(true);
  const [isBinDetailsOpen, setIsBinDetailsOpen] = useState<boolean>(false);

  // Use ONLY real-time bin locations from database - no hardcoded coordinates
  const updatedLocationData =
    dynamicBinLocations && dynamicBinLocations.length > 0
      ? dynamicBinLocations.map((bin) => ({
          id: bin.id,
          name: bin.name,
          lat: bin.position?.[0]?.toString() || "0",
          lng: bin.position?.[1]?.toString() || "0",
          status: bin.status,
          level: bin.level,
          lastCollected: bin.lastCollection,
          binData: bin,
          // Include all the real-time data properties
          position: bin.position,
          weight_kg: bin.weight_kg,
          distance_cm: bin.distance_cm,
          satellites: bin.satellites,
          gps_valid: bin.gps_valid,
          coordinates_source: bin.coordinates_source,
          last_active: bin.last_active,
          gps_timestamp: bin.gps_timestamp,
        }))
      : []; // No fallback to hardcoded coordinates - only show real-time data

  // Calculate summary statistics
  const criticalBins = updatedLocationData.filter((location) => location.status === "critical").length;
  const warningBins = updatedLocationData.filter((location) => location.status === "warning").length;
  const normalBins = updatedLocationData.filter((location) => location.status === "normal").length;

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setBinForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Form submission started:", { selectedBinId, binForm });

    if (!selectedBinId) {
      toast.error("Please select a bin to update");
      return;
    }

    try {
      console.log("Calling updateBin with:", selectedBinId, binForm);
      const success = await updateBin(selectedBinId, binForm);
      console.log("Update result:", success);

      if (success) {
        toast.success("Bin details updated successfully!");
        // Refresh the real-time data to get updated information
        console.log("Refreshing data after successful update...");
        await refresh();
        setIsEditing(false);
        setSelectedBinId("");
        // Reset form
        setBinForm({
          binName: "",
          binType: "",
          mainLocation: "",
        });
        console.log("Form reset and panel closed");
      } else {
        toast.error("Failed to update bin details");
      }
    } catch (error) {
      toast.error("An error occurred while updating bin details");
      console.error("Update error:", error);
    }
  };

  // Load bin data for editing (called when clicking on map bin)
  const loadBinForEdit = (bin: { id?: string; name?: string; type?: string; mainLocation?: string }) => {
    console.log("Loading bin for edit:", bin);
    // Map the real-time database structure to form fields
    // Use actual data from Firebase
    const formData = {
      binName: bin.name || bin.id || "",
      binType: bin.type || "general", // Use actual type from Firebase
      mainLocation: bin.mainLocation || "central-plaza", // Use actual mainLocation from Firebase
    };
    console.log("Setting form data:", formData);
    setBinForm(formData);
    setSelectedBinId(bin.id || "");
    setIsEditing(true);
  };

  // Function to be called from map component when bin is clicked
  const handleBinClick = (binId: string) => {
    console.log("Bin clicked:", binId);
    console.log("Available bins:", updatedLocationData);

    const selectedBin = updatedLocationData.find((bin) => bin.id === binId);
    if (selectedBin) {
      console.log("Selected bin data:", selectedBin);
      loadBinForEdit(selectedBin);
      setIsBinDetailsOpen(true);
    } else {
      console.warn("Bin not found in updatedLocationData:", binId);
    }
  };

  // Handle route selection
  const handleRouteSelect = (route: string) => {
    setSelectedRoute(route);
    toast.success(`${route.charAt(0).toUpperCase() + route.slice(1).replace("-", " ")} route selected`);
  };

  // Toggle location dropdown
  const toggleLocationDropdown = () => {
    setIsLocationDropdownOpen(!isLocationDropdownOpen);
  };
  // Show skeleton while loading
  if (loading) {
    return <StaffMapSkeleton />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Map View</h2>
          <div className="flex items-center gap-3 text-xs">
            {" "}
            {/* smaller font */}
            {/* Real-time Status Display */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> {/* smaller dot */}
                <span className="text-gray-700 dark:text-gray-300">Critical ({criticalBins})</span>
              </div>

              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>

              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Warning ({warningBins})</span>
              </div>

              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>

              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Normal ({normalBins})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full pb-5">
          <StaffMapSection
            onBinClick={handleBinClick}
            showRightPanel={isBinDetailsOpen}
            isPanelOpen={isBinDetailsOpen}
            rightPanel={
              <div className="w-[420px] h-[520px] bg-black/20 border-l border-white/20 shadow-2xl rounded-l-xl backdrop-blur-lg transform transition-transform duration-300 ease-out">
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Bin Details</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsBinDetailsOpen(false)}
                      className="text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors duration-200"
                    >
                      ×
                    </Button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Bin Name */}
                      <div className="space-y-2">
                        <Label htmlFor="binName" className="text-sm font-medium text-white">
                          Bin Name
                        </Label>
                        <Input
                          id="binName"
                          type="text"
                          value={binForm.binName}
                          onChange={(e) => handleInputChange("binName", e.target.value)}
                          placeholder="Enter bin name"
                          className="w-full bg-white/10 border-white/30 text-white placeholder:text-white/70 focus:border-blue-400 transition-colors duration-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="wasteType" className="text-sm font-medium text-white">
                          Waste Type
                        </Label>
                        <Select value={binForm.binType} onValueChange={(value) => handleInputChange("binType", value)}>
                          <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400 transition-colors duration-200">
                            <SelectValue placeholder="Select waste type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General Waste</SelectItem>
                            <SelectItem value="recyclable">Recyclable</SelectItem>
                            <SelectItem value="organic">Organic</SelectItem>
                            <SelectItem value="hazardous">Hazardous</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Main Location */}
                      <div className="space-y-2">
                        <Label htmlFor="mainLocation" className="text-sm font-medium text-white">
                          Location
                        </Label>
                        <Select
                          value={binForm.mainLocation}
                          onValueChange={(value) => handleInputChange("mainLocation", value)}
                        >
                          <SelectTrigger className="bg-white/10 border-white/30 text-white focus:border-blue-400 transition-colors duration-200">
                            <SelectValue placeholder="Select main location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="central-plaza">Central Plaza</SelectItem>
                            <SelectItem value="park-avenue">Park Avenue</SelectItem>
                            <SelectItem value="mall-district">Mall District</SelectItem>
                            <SelectItem value="residential">Residential Area</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 mt-auto">
                      <Button
                        type="submit"
                        className="w-full bg-green-700 hover:bg-green-800 text-white transition-all duration-200 shadow-lg hover:shadow-xl border border-green-600/50"
                        disabled={isUpdating || !selectedBinId}
                      >
                        {isUpdating ? "Updating..." : "Save Changes"}
                      </Button>
                    </div>

                    {/* Error Display */}
                    {updateError && (
                      <div className="text-sm text-red-200 bg-red-500/20 border border-red-400/50 p-3 rounded-lg">
                        {updateError}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {/* Panel now rendered inside map container above */}
    </>
  );
}
