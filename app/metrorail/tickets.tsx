import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StationSelector } from "../../components/StationSelector";
import { ALL_STOPS } from "../../constants/allStops";
import { usePaymentMethods, useUserTickets, useUserWallet } from "../../hooks/useAppwrite";
import { COLORS, TYPOGRAPHY, SPACING } from "../../constants/theme";
import type { MultimodalStop } from "../../types";
import {
  calculateDistance,
  getFarePrice,
  FARE_TYPES,
  FARE_CATEGORIES,
} from "../../constants/fareData";
import { PaymentMethodModal } from "@/components/PaymentMethodModal";
import { AddPaymentMethodModal } from "@/components/add-payment-method";
import { useUser } from "@clerk/clerk-expo";
import * as crypto from 'expo-crypto';
import { useTicketPurchase } from '../../hooks/useTicketPurchase';

// Only train stops
const TRAIN_STOPS = ALL_STOPS.filter(stop => stop.mode === 'train');

export default function TicketsScreen() {
  const { user } = useUser();
  const {
    tickets,
    loading: ticketsLoading,
    createTicket,
    updateTicket,
    deleteTicket,
    refreshTickets,
  } = useUserTickets();
  const {
    wallet,
    purchaseTicket,
    chargeUser,
    refundUser,
  } = useUserWallet();
  const { paymentMethods, addCard, addBankAccount } = usePaymentMethods();
  const { purchaseWithLoanSupport } = useTicketPurchase();

  const [activeTab, setActiveTab] = useState("buy");
  const [selectedCategory, setSelectedCategory] = useState("metro");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedMyTicket, setSelectedMyTicket] = useState<any>(null);
  const [fromStation, setFromStation] = useState<MultimodalStop | null>(null);
  const [toStation, setToStation] = useState<MultimodalStop | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [selectedTicketData, setSelectedTicketData] = useState<any>(null);
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editedTicketData, setEditedTicketData] = useState<any>(null);
  const [priceDifference, setPriceDifference] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshTickets = async () => {
    setRefreshing(true);
    try {
      await refreshTickets();
    } finally {
      setRefreshing(false);
    }
  };

  const handleFromStationSelect = (station: MultimodalStop) => {
    setFromStation(station);
  };

  const handleToStationSelect = (station: MultimodalStop) => {
    setToStation(station);
  };

  const calculateJourneyDistance = (): number => {
    if (!fromStation || !toStation) return 0;
    return calculateDistance(
      fromStation.coordinates.latitude,
      fromStation.coordinates.longitude,
      toStation.coordinates.latitude,
      toStation.coordinates.longitude
    );
  };

  const getTicketPrice = (fareTypeId: string): string => {
    const distance = calculateJourneyDistance();
    if (distance === 0) return "Select stations";
    return getFarePrice(distance, selectedCategory, fareTypeId);
  };

  const getValidUntilDate = (ticketType: string): string => {
    const now = new Date();
    switch (ticketType) {
      case "single":
      case "return":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case "weekly":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case "monthly":
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const generateQRCode = (): string => {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.getRandomValues(new Uint8Array(4));
    const randomStr = Array.from(randomBytes)
      .map((byte) => byte.toString(36).padStart(2, '0'))
      .join('');
    return `TK${timestamp}${randomStr}`.toUpperCase();
  };

  const handleAddPaymentMethod = () => {
    setShowPaymentModal(false);
    setShowAddPaymentModal(true);
  };

  const handleAddCard = async (cardData: any) => {
    try {
      await addCard(cardData);
      setShowAddPaymentModal(false);
      setShowPaymentModal(true);
      Alert.alert("Success", "Payment method added successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to add payment method");
    }
  };

  const handleAddBankAccount = async (bankData: any) => {
    try {
      await addBankAccount(bankData);
      setShowAddPaymentModal(false);
      setShowPaymentModal(true);
      Alert.alert("Success", "Bank account added successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to add bank account");
    }
  };

  const handleBuyTicket = async (ticketTypeId: string) => {
    if (!fromStation || !toStation) {
      Alert.alert("Selection Required", "Please select both origin and destination stations.");
      return;
    }

    const distance = calculateJourneyDistance();
    const priceString = getFarePrice(distance, selectedCategory, ticketTypeId);
    const price = Number.parseFloat(priceString.replace("R", ""));

    setSelectedTicketData({
      ticketType: ticketTypeId,
      serviceCategory: selectedCategory,
      fromStation: fromStation.name,
      toStation: toStation.name,
      fromStationId: fromStation.id,
      toStationId: toStation.id,
      distance: distance,
      price: price,
      currency: "ZAR",
      status: "active",
      validFrom: new Date().toISOString(),
      validUntil: getValidUntilDate(ticketTypeId),
      purchaseMethod: "wallet",
    });
    setShowPaymentModal(true);
  };

  const calculateNewPrice = () => {
    if (!editedTicketData || !selectedMyTicket) return 0;
    
    const fromStation = TRAIN_STOPS.find(s => s.id === editedTicketData.fromStationId);
    const toStation = TRAIN_STOPS.find(s => s.id === editedTicketData.toStationId);
    
    if (!fromStation || !toStation) return 0;

    const distance = calculateDistance(
      fromStation.coordinates.latitude,
      fromStation.coordinates.longitude,
      toStation.coordinates.latitude,
      toStation.coordinates.longitude
    );

    return Number.parseFloat(
      getFarePrice(distance, selectedMyTicket.serviceCategory, selectedMyTicket.ticketType).replace("R", "")
    );
  };

  useEffect(() => {
    if (isEditingTicket && editedTicketData) {
      const newPrice = calculateNewPrice();
      setPriceDifference(newPrice - selectedMyTicket.price);
    }
  }, [editedTicketData?.fromStationId, editedTicketData?.toStationId]);

  const handleUpdateTicket = async () => {
    if (!editedTicketData || !selectedMyTicket || priceDifference === null) return;
    
    try {
      const fromStation = TRAIN_STOPS.find(s => s.id === editedTicketData.fromStationId);
      const toStation = TRAIN_STOPS.find(s => s.id === editedTicketData.toStationId);
      
      if (!fromStation || !toStation) {
        throw new Error("Invalid station selection");
      }

      const newPrice = calculateNewPrice();
      const originalPrice = selectedMyTicket.price;
      const priceDifference = newPrice - originalPrice;

      if (priceDifference > 0) {
        const confirmed = await new Promise((resolve) => {
          Alert.alert(
            "Confirm Upgrade",
            `This change will cost an additional R${priceDifference.toFixed(2)}. Continue?`,
            [
              { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
              { text: "Confirm", onPress: () => resolve(true) },
            ]
          );
        });
        if (!confirmed) return;
      }

      if (priceDifference > 0) {
        await chargeUser(
          priceDifference,
          `Ticket upgrade: ${selectedMyTicket.fromStation}→${selectedMyTicket.toStation} to ${fromStation.name}→${toStation.name}`
        );
      } else if (priceDifference < 0) {
        await refundUser(
          Math.abs(priceDifference),
          `Ticket partial refund: ${selectedMyTicket.fromStation}→${selectedMyTicket.toStation} to ${fromStation.name}→${toStation.name}`
        );
      }

      const updatedTicket = await updateTicket(selectedMyTicket.$id, {
        fromStation: fromStation.name,
        toStation: toStation.name,
        fromStationId: fromStation.id,
        toStationId: toStation.id,
        distance: calculateDistance(
          fromStation.coordinates.latitude,
          fromStation.coordinates.longitude,
          toStation.coordinates.latitude,
          toStation.coordinates.longitude
        ),
        price: newPrice,
      });

      setSelectedMyTicket(updatedTicket);
      setIsEditingTicket(false);
      setPriceDifference(null);
      
      Alert.alert(
        "Success", 
        priceDifference > 0 
          ? `Ticket updated! Additional R${priceDifference.toFixed(2)} was charged.`
          : priceDifference < 0
            ? `Ticket updated! R${Math.abs(priceDifference).toFixed(2)} was refunded.`
            : "Ticket updated with no price change"
      );
    } catch (error) {
      Alert.alert(
        "Error", 
        error instanceof Error ? error.message : "Failed to update ticket"
      );
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    Alert.alert(
      "Delete Ticket",
      "Are you sure you want to delete this ticket?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTicket(ticketId);
              setShowTicketModal(false);
              Alert.alert("Success", "Ticket deleted successfully");
            } catch (error) {
              Alert.alert("Error", "Failed to delete ticket");
            }
          }
        }
      ]
    );
  };

  const handleShowTicket = (ticket: any) => {
    setSelectedMyTicket(ticket);
    setEditedTicketData({
      fromStation: ticket.fromStation,
      toStation: ticket.toStation,
      fromStationId: ticket.fromStationId,
      toStationId: ticket.toStationId
    });
    setShowTicketModal(true);
    setIsEditingTicket(false);
  };

  const handlePaymentMethodSelect = async (method: string, service?: string, journeyDetails?: any) => {
    if (method !== 'wallet') {
      Alert.alert('Coming Soon', 'Only wallet payments are supported.');
      return;
    }
    if (!selectedTicketData) return;

    try {
      await purchaseWithLoanSupport({
        service: 'metrorail',
        amount: selectedTicketData.price,
        description: `${selectedTicketData.ticketType} ticket: ${selectedTicketData.fromStation} → ${selectedTicketData.toStation}`,
        from: selectedTicketData.fromStation,
        to: selectedTicketData.toStation,
        onSuccess: async () => {
          Alert.alert('Success', 'Ticket purchased successfully!');
          await refreshTickets();
          setActiveTab('my');
          setSelectedTicketData(null);
          setShowPaymentModal(false);
        },
        onInsufficient: () => {
          Alert.alert('Insufficient Balance', 'Please top up your wallet to purchase this ticket.');
        }
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Purchase failed');
    }
  };

  const renderTicketType = (ticket: any) => {
    const displayPrice = getTicketPrice(ticket.id);
    const isDisabled = !fromStation || !toStation;

    return (
      <LinearGradient
        key={ticket.id}
        colors={['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.ticketCard}
      >
        <View style={styles.ticketInfo}>
          <Text style={styles.ticketName}>{ticket.name}</Text>
          <Text style={styles.ticketDescription}>{ticket.description}</Text>
        </View>
        <View style={styles.ticketPricing}>
          <Text style={styles.ticketPrice}>{displayPrice}</Text>
          <TouchableOpacity
            style={[styles.buyButton, isDisabled && styles.buyButtonDisabled]}
            onPress={() => handleBuyTicket(ticket.id)}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buyButtonGradient}
            >
              <Text style={styles.buyButtonText}>Buy Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  };

  const renderMyTicket = (ticket: any) => (
    <TouchableOpacity 
      key={ticket.$id} 
      style={styles.myTicketCardWrapper}
      onPress={() => handleShowTicket(ticket)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.myTicketCard}
      >
        <View style={styles.myTicketHeader}>
          <Text style={styles.myTicketType}>{ticket.ticketType}</Text>
          <View style={[styles.statusBadge, { backgroundColor: ticket.status === "active" ? "#10B981" : "#6B7280" }]}>
            <Text style={styles.statusText}>{ticket.status}</Text>
          </View>
        </View>
        <View style={styles.myTicketRoute}>
          <Text style={styles.routeText}>
            {ticket.fromStation} → {ticket.toStation}
          </Text>
          <Text style={styles.distanceText}>{ticket.distance.toFixed(1)}km</Text>
        </View>
        <View style={styles.myTicketFooter}>
          <Text style={styles.ticketDate}>Valid until: {new Date(ticket.validUntil).toLocaleDateString()}</Text>
          <Text style={styles.ticketPriceSmall}>R{ticket.price.toFixed(2)}</Text>
        </View>
        <View style={styles.categoryTag}>
          <Text style={styles.categoryTagText}>
            {FARE_CATEGORIES.find((c) => c.id === ticket.serviceCategory)?.name}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FA']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Metrorail Tickets</Text>
          <Text style={styles.walletBalance}>Balance: R{wallet?.balance.toFixed(2) || "0.00"}</Text>
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "buy" && styles.activeTab]}
          onPress={() => setActiveTab("buy")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "buy" && styles.activeTabText]}>Buy Tickets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "my" && styles.activeTab]}
          onPress={() => setActiveTab("my")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "my" && styles.activeTabText]}>My Tickets</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "buy" ? (
          <View style={styles.buyTicketsContainer}>
            <View style={styles.categoryContainer}>
              <Text style={styles.sectionTitle}>Service Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContainer}
              >
                {FARE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryButton, selectedCategory === category.id && styles.categoryButtonActive]}
                    onPress={() => setSelectedCategory(category.id)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={selectedCategory === category.id ? [COLORS.primary + '10', COLORS.primary + '05'] : ['#FFFFFF', '#F9FAFB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.categoryGradient}
                    >
                      <Text style={[styles.categoryButtonText, selectedCategory === category.id && styles.categoryButtonTextActive]}>
                        {category.name}
                      </Text>
                      <Text style={styles.categoryDescription}>{category.description}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.stationSelectionContainer}>
              <Text style={styles.sectionTitle}>Journey Details</Text>
              <LinearGradient
                colors={['#FFFFFF', '#F9FAFB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.stationCard}
              >
                <View style={styles.stationInputContainer}>
                  <View style={styles.stationDot} />
                  <View style={styles.stationInput}>
                    <StationSelector
                      label="FROM"
                      selectedStation={fromStation}
                      onStationSelect={handleFromStationSelect}
                      placeholder="Select departure station"
                      stations={TRAIN_STOPS}
                    />
                  </View>
                </View>

                <View style={styles.stationInputContainer}>
                  <View style={[styles.stationDot, styles.destinationDot]} />
                  <View style={styles.stationInput}>
                    <StationSelector
                      label="TO"
                      selectedStation={toStation}
                      onStationSelect={handleToStationSelect}
                      placeholder="Select destination station"
                      stations={TRAIN_STOPS}
                    />
                  </View>
                </View>

                {fromStation && toStation && (
                  <View style={styles.journeyInfo}>
                    <Text style={styles.journeyDistance}>Distance: {calculateJourneyDistance().toFixed(1)}km</Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            <Text style={styles.sectionTitle}>Choose Your Ticket</Text>
            {FARE_TYPES.map(renderTicketType)}

            <LinearGradient
              colors={['#F0F9FF', '#E0F2FE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.infoCard}
            >
              <Text style={styles.infoTitle}>💡 Fare Information</Text>
              <Text style={styles.infoText}>• Fares calculated by distance traveled</Text>
              <Text style={styles.infoText}>• Metro: Standard service</Text>
              <Text style={styles.infoText}>• MetroPlus: Enhanced comfort</Text>
              <Text style={styles.infoText}>• MetroPlus Express: Premium service</Text>
              <Text style={styles.infoText}>• Weekly and monthly passes offer best value</Text>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.myTicketsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Tickets</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshTickets} disabled={refreshing} activeOpacity={0.7}>
                <Text style={[styles.refreshButtonText, refreshing && styles.refreshButtonDisabled]}>
                  {refreshing ? "Refreshing..." : "🔄 Refresh"}
                </Text>
              </TouchableOpacity>
            </View>
            {ticketsLoading || refreshing ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading tickets...</Text>
              </View>
            ) : tickets.length === 0 ? (
              <LinearGradient
                colors={['#FFFFFF', '#F9FAFB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.emptyState}
              >
                <Text style={styles.emptyStateText}>🎫</Text>
                <Text style={styles.emptyStateTitle}>No tickets yet</Text>
                <Text style={styles.emptyStateSubtitle}>Buy your first ticket from the Buy Tickets tab</Text>
              </LinearGradient>
            ) : (
              tickets.map(renderMyTicket)
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showTicketModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTicketModal(false)} style={styles.modalCloseButton}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isEditingTicket ? "Edit Ticket" : "Your Ticket"}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedMyTicket && (
            <View style={styles.ticketDisplay}>
              {isEditingTicket ? (
                <LinearGradient
                  colors={['#FFFFFF', '#F9FAFB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.editForm}
                >
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>From Station:</Text>
                    <StationSelector
                      label="From Station"
                      selectedStation={TRAIN_STOPS.find(s => s.id === editedTicketData.fromStationId) || null}
                      onStationSelect={(station) => setEditedTicketData({
                        ...editedTicketData,
                        fromStation: station.name,
                        fromStationId: station.id
                      })}
                      placeholder="Select departure station"
                      stations={TRAIN_STOPS}
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>To Station:</Text>
                    <StationSelector
                      label="To Station" 
                      selectedStation={TRAIN_STOPS.find(s => s.id === editedTicketData.toStationId) || null}
                      onStationSelect={(station) => setEditedTicketData({
                        ...editedTicketData,
                        toStation: station.name,
                        toStationId: station.id
                      })}
                      placeholder="Select destination station"
                      stations={TRAIN_STOPS}
                    />
                  </View>

                  <View style={styles.priceChangeContainer}>
                    <Text style={styles.priceChangeText}>
                      Original: R{selectedMyTicket.price.toFixed(2)}
                    </Text>
                    <Text style={styles.priceChangeText}>
                      New: R{calculateNewPrice().toFixed(2)}
                    </Text>
                    {priceDifference !== null && priceDifference !== 0 && (
                      <Text style={[
                        styles.priceDifferenceText,
                        priceDifference > 0 ? styles.priceIncrease : styles.priceDecrease
                      ]}>
                        {priceDifference > 0 
                          ? `+R${priceDifference.toFixed(2)} will be charged`
                          : `R${Math.abs(priceDifference).toFixed(2)} will be refunded`}
                      </Text>
                    )}
                  </View>

                  <View style={styles.editActions}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => setIsEditingTicket(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.saveButton]}
                      onPress={handleUpdateTicket}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveButtonGradient}
                      >
                        <Text style={styles.actionButtonText}>Save Changes</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              ) : (
                <>
                  <View style={styles.ticketDisplayHeader}>
                    <Text style={styles.ticketDisplayType}>{selectedMyTicket.ticketType}</Text>
                    <Text style={styles.ticketDisplayPrice}>R{selectedMyTicket.price.toFixed(2)}</Text>
                  </View>

                  <View style={styles.categoryTagLarge}>
                    <Text style={styles.categoryTagTextLarge}>
                      {FARE_CATEGORIES.find((c) => c.id === selectedMyTicket.serviceCategory)?.name}
                    </Text>
                  </View>

                  <View style={styles.qrCodeContainer}>
                    <LinearGradient
                      colors={['#F3F4F6', '#E5E7EB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.qrCodePlaceholder}
                    >
                      <Text style={styles.qrCodeText}>QR CODE</Text>
                      <Text style={styles.qrCodeId}>{selectedMyTicket.qrCode}</Text>
                    </LinearGradient>
                  </View>

                  <View style={styles.ticketDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>From:</Text>
                      <Text style={styles.detailValue}>{selectedMyTicket.fromStation}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>To:</Text>
                      <Text style={styles.detailValue}>{selectedMyTicket.toStation}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Distance:</Text>
                      <Text style={styles.detailValue}>{selectedMyTicket.distance.toFixed(1)}km</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Valid Until:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedMyTicket.validUntil).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.instructionText}>
                    Show this QR code to the conductor when requested
                  </Text>

                  <View style={styles.ticketActions}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => setIsEditingTicket(true)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.editButtonGradient}
                      >
                        <Text style={styles.actionButtonText}>Edit Ticket</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteTicket(selectedMyTicket.$id)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#EF4444', '#DC2626']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.deleteButtonGradient}
                      >
                        <Text style={styles.actionButtonText}>Delete Ticket</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <PaymentMethodModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedTicketData(null);
        }}
        onSelectPayment={handlePaymentMethodSelect}
        onAddPaymentMethod={handleAddPaymentMethod}
        amount={selectedTicketData?.price || 0}
        walletBalance={wallet?.balance || 0}
        customPaymentMethods={paymentMethods.map((method) => ({
          id: method.$id,
          name: method.name,
          icon: method.type === "card" ? "💳" : "🏦",
          description: method.description,
          available: true,
          isCustom: true,
          lastFour: method.lastFour,
          expiryDate: method.expiryDate,
          cardType: method.cardType,
        }))}
      />

      <AddPaymentMethodModal
        visible={showAddPaymentModal}
        onClose={() => {
          setShowAddPaymentModal(false);
          setShowPaymentModal(true);
        }}
        onAddCard={handleAddCard}
        onAddBankAccount={handleAddBankAccount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizes.xl,
    fontWeight: "bold",
    color: COLORS.gray900,
  },
  walletBalance: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    color: COLORS.primary,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "500",
    color: COLORS.gray600,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  buyTicketsContainer: {
    padding: SPACING.xl,
  },
  myTicketsContainer: {
    padding: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "bold",
    color: COLORS.gray900,
    marginBottom: SPACING.md,
  },
  categoryContainer: {
    marginBottom: SPACING.xl,
  },
  categoryScrollContainer: {
    paddingRight: SPACING.xl,
  },
  categoryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: SPACING.md,
    minWidth: 140,
    maxWidth: 160,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryGradient: {
    padding: SPACING.md,
  },
  categoryButtonActive: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  categoryButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  categoryButtonTextActive: {
    color: COLORS.primary,
  },
  categoryDescription: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
  },
  stationSelectionContainer: {
    marginBottom: SPACING.xl,
  },
  stationCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  stationInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gray400,
    marginRight: SPACING.md,
  },
  destinationDot: {
    backgroundColor: COLORS.primary,
  },
  stationInput: {
    flex: 1,
  },
  journeyInfo: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
  journeyDistance: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    color: COLORS.primary,
  },
  ticketCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  ticketDescription: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray600,
  },
  ticketPricing: {
    alignItems: "flex-end",
  },
  ticketPrice: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  buyButton: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonGradient: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  buyButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    textAlign: "center",
    color: COLORS.gray600,
    fontSize: TYPOGRAPHY.fontSizes.base,
  },
  myTicketCardWrapper: {
    marginBottom: SPACING.md,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  myTicketCard: {
    padding: SPACING.lg,
  },
  myTicketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  myTicketType: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
    textTransform: "capitalize",
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.xs,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  myTicketRoute: {
    marginBottom: SPACING.sm,
  },
  routeText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray600,
    marginBottom: 2,
  },
  distanceText: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.primary,
    fontWeight: "600",
  },
  myTicketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketDate: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray600,
  },
  ticketPriceSmall: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    color: COLORS.primary,
  },
  categoryTag: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.primary + "20",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.primary,
    fontWeight: "600",
  },
  categoryTagLarge: {
    alignSelf: "center",
    backgroundColor: COLORS.primary + "20",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    marginBottom: SPACING.lg,
  },
  categoryTagTextLarge: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.primary,
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
    marginBottom: SPACING.md,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    borderRadius: 20,
    marginTop: SPACING.lg,
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSizes["3xl"],
    marginBottom: SPACING.md,
  },
  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "600",
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  emptyStateSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray600,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  refreshButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "10",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  refreshButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.primary,
    fontWeight: "500",
  },
  refreshButtonDisabled: {
    color: COLORS.gray400,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  closeButton: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    color: COLORS.gray600,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  ticketDisplay: {
    flex: 1,
    padding: SPACING.xl,
  },
  ticketDisplayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  ticketDisplayType: {
    fontSize: TYPOGRAPHY.fontSizes.xl,
    fontWeight: "bold",
    color: COLORS.gray900,
    textTransform: "capitalize",
  },
  ticketDisplayPrice: {
    fontSize: TYPOGRAPHY.fontSizes.xl,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  qrCodeContainer: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  qrCodeText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
  },
  qrCodeId: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray400,
  },
  ticketDetails: {
    backgroundColor: COLORS.gray100,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray600,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  instructionText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray600,
    textAlign: "center",
    lineHeight: 20,
  },
  ticketActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  editButton: {
    overflow: 'hidden',
  },
  editButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  deleteButton: {
    overflow: 'hidden',
  },
  deleteButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.gray500,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  editForm: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  editField: {
    marginBottom: SPACING.md,
  },
  editLabel: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    marginBottom: SPACING.xs,
    color: COLORS.gray700,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  priceChangeContainer: {
    marginVertical: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.gray100,
    borderRadius: 16,
  },
  priceChangeText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    marginBottom: 2,
  },
  priceDifferenceText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "600",
    marginTop: SPACING.xs,
  },
  priceIncrease: {
    color: "#EF4444",
  },
  priceDecrease: {
    color: "#10B981",
  },
});