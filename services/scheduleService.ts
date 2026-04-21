import { scheduleData } from "../constants/realData";
import type { ScheduleData, Train } from "@/types";

export const findMatchingRoute = (from: string, to: string): ScheduleData | undefined => {
  return scheduleData.find(route => {
    const isOutboundMatch = 
      route.start.toLowerCase().includes(from.toLowerCase()) && 
      route.end.toLowerCase().includes(to.toLowerCase());
    
    const isInboundMatch = 
      route.end.toLowerCase().includes(from.toLowerCase()) && 
      route.start.toLowerCase().includes(to.toLowerCase());
    
    return isOutboundMatch || isInboundMatch;
  });
};

export const getDirection = (from: string, to: string, route: ScheduleData): "outbound" | "inbound" => {
  const isOutbound = 
    route.start.toLowerCase().includes(from.toLowerCase()) && 
    route.end.toLowerCase().includes(to.toLowerCase());
  
  return isOutbound ? "outbound" : "inbound";
};

export const getDisplayDirection = (route: ScheduleData, direction: "outbound" | "inbound"): string => {
  return direction === "outbound" 
    ? `${route.start} → ${route.end}`
    : `${route.end} → ${route.start}`;
};

export const getFilteredTrains = (route: ScheduleData, direction: "outbound" | "inbound"): Train[] => {
  return direction === "outbound" 
    ? route.trainsOutbound 
    : route.trainsInbound;
};