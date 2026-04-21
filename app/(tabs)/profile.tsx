import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Switch, Alert, Image, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUserProfile, useUserStats } from '@/hooks/useAppwrite';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import type { DriverProfile } from '@/types/appwrite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingScreen, Card, PrimaryButton, StatusPill } from '@/components/ui';

// ─── Driver Status Card (unchanged) ──────────────────
function DriverCard({
  icon, title, loading, status, onRegister, onDashboard, onReapply,
}: {
  icon: string; title: string; loading: boolean;
  status: string | null; // null = not registered, 'approved', 'pending', 'rejected'
  onRegister: () => void;
  onDashboard: () => void;
  onReapply?: () => void;
}) {
  return (
    <View style={dStyles.card}>
      <View style={dStyles.cardTop}>
        <Text style={dStyles.cardIcon}>{icon}</Text>
        <Text style={dStyles.cardTitle}>{title}</Text>
        {status && <StatusPill status={status} />}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: SPACING.xs }} />
      ) : !status ? (
        <PrimaryButton label="Register" onPress={onRegister} variant="secondary" style={dStyles.cardBtn} />
      ) : status === 'approved' ? (
        <PrimaryButton label="Go to Dashboard →" onPress={onDashboard} style={dStyles.cardBtn} />
      ) : status === 'pending' ? (
        <Text style={dStyles.pendingNote}>Your application is under review. We'll notify you soon.</Text>
      ) : status === 'rejected' ? (
        <PrimaryButton label="Reapply" onPress={onReapply!} variant="danger" style={dStyles.cardBtn} />
      ) : null}
    </View>
  );
}

const dStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  cardIcon: { fontSize: 22 },
  cardTitle: { ...TYPOGRAPHY.bodyBold, flex: 1 },
  cardBtn: { marginTop: SPACING.xs },
  pendingNote: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, fontStyle: 'italic' },
});

// ─── Menu Item (unchanged) ─────────────────────────
function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={mStyles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={mStyles.iconWrap}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text style={mStyles.label}>{label}</Text>
      <Text style={mStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const mStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  label: { ...TYPOGRAPHY.body, flex: 1, color: COLORS.textPrimary },
  chevron: { fontSize: 22, color: COLORS.textMuted },
});

// ─── Main Screen ────────────────────────────────────
export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { profile, loading, updateProfile } = useUserProfile();
  const { stats } = useUserStats();
  const [trustScore, setTrustScore] = useState<number>(profile?.trustScore ?? 100);

  // Legacy taxi driver (old collection) – kept for reference, not used in UI
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [driverLoading, setDriverLoading] = useState(true);

  // New taxi driver (from TAXI_DRIVERS)
  const [taxiDriver, setTaxiDriver] = useState<any>(null);
  const [taxiDriverLoading, setTaxiDriverLoading] = useState(true);

  // School driver (unchanged)
  const [schoolDriver, setSchoolDriver] = useState<any>(null);
  const [schoolDriverLoading, setSchoolDriverLoading] = useState(true);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', address: '', city: '', province: '', postalCode: '' });
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notifications ?? true);
  const [locationEnabled, setLocationEnabled] = useState(profile?.locationServices ?? false);

  useFocusEffect(
    useCallback(() => {
      loadLegacyTaxiProfile();
      loadTaxiDriverFromNewCollection();
      loadSchoolDriverProfile();
    }, [user])
  );

  useEffect(() => {
    if (profile) setTrustScore(profile.trustScore ?? 100);
  }, [profile]);

  // Legacy (old) – kept for compatibility
  const loadLegacyTaxiProfile = async () => {
    if (!user) return;
    setDriverLoading(true);
    try {
      const storedId = await AsyncStorage.getItem('driverProfileId');
      if (storedId) {
        try {
          const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_PROFILES, storedId) as DriverProfile;
          setDriverProfile(doc);
          return;
        } catch {}
      }
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_PROFILES, [Query.equal('userId', user.id)]);
      if (res.documents.length > 0) {
        const doc = res.documents[0] as DriverProfile;
        setDriverProfile(doc);
        await AsyncStorage.setItem('driverProfileId', doc.$id);
      } else {
        setDriverProfile(null);
      }
    } catch (e) { console.error(e); }
    finally { setDriverLoading(false); }
  };

  // NEW: Load taxi driver from TAXI_DRIVERS collection (myMetro)
  const loadTaxiDriverFromNewCollection = async () => {
    if (!user) return;
    setTaxiDriverLoading(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [
        Query.equal('userId', user.id)
      ]);
      if (res.documents.length > 0) {
        setTaxiDriver(res.documents[0]);
      } else {
        setTaxiDriver(null);
      }
    } catch (e) { console.error(e); }
    finally { setTaxiDriverLoading(false); }
  };

  // School driver (unchanged)
  const loadSchoolDriverProfile = async () => {
    if (!user) return;
    setSchoolDriverLoading(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [Query.equal('userId', user.id)]);
      setSchoolDriver(res.documents.length > 0 ? res.documents[0] : null);
    } catch (e) { console.error(e); }
    finally { setSchoolDriverLoading(false); }
  };

  // Determine taxi driver status for UI
  const taxiStatus = taxiDriver ? 'approved' : null; // For MVP, existence means approved
  // You can later add a 'status' field to TAXI_DRIVERS for pending/rejected

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            await AsyncStorage.removeItem('driverProfileId');
            router.replace('/');
          } catch { Alert.alert('Error', 'Failed to sign out'); }
        },
      },
    ]);
  };

  const handleEditProfile = () => {
    setEditForm({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      city: profile?.city || '',
      province: profile?.province || '',
      postalCode: profile?.postalCode || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(editForm);
      setEditModalVisible(false);
      Alert.alert('Saved!', 'Your profile has been updated.');
    } catch { Alert.alert('Error', 'Failed to update profile'); }
  };

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    try { await updateProfile({ notifications: value, locationServices: locationEnabled }); } catch {}
  };

  const handleToggleLocation = async (value: boolean) => {
    setLocationEnabled(value);
    try { await updateProfile({ notifications: notificationsEnabled, locationServices: value }); } catch {}
  };

  const initials = profile
    ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase()
    : 'ME';

  const trustColor = trustScore >= 80 ? COLORS.success : trustScore >= 50 ? COLORS.accent : COLORS.error;
  const trustBg = trustScore >= 80 ? COLORS.successLight : trustScore >= 50 ? COLORS.accentLight : COLORS.errorLight;
  const trustLabel = trustScore >= 80 ? 'Excellent — you qualify for micro-loans' : trustScore >= 50 ? 'Good — micro-loans available' : 'Low — repay loans on time to improve';

  const menuItems = [
    { icon: '💳', label: 'Add Card', route: '/payment-methods' },
    { icon: '📋', label: 'Travel History', route: '/travel-history' },
    { icon: '💰', label: 'Loan History', route: '/loan-history' },
    { icon: '⭐', label: 'Favourites', route: '/favorites' },
    { icon: '❓', label: 'Help & Support', route: '/help-support' },
    { icon: '📄', label: 'Terms & Conditions', route: '/terms' },
    { icon: '🔒', label: 'Privacy Policy', route: '/privacy' },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        {/* Avatar + name */}
        <View style={styles.heroSection}>
          <View style={styles.avatarRing}>
            {profile?.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroName}>{profile?.firstName} {profile?.lastName}</Text>
          <Text style={styles.heroEmail}>{profile?.email}</Text>
          {profile?.phone && <Text style={styles.heroPhone}>{profile.phone}</Text>}
          <TouchableOpacity style={styles.editBtn} onPress={handleEditProfile} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <Card style={styles.statsCard}>
          {[
            { value: stats.totalTrips.toString(), label: 'Total Trips' },
            { value: `R${stats.currentMonthSpent.toFixed(0)}`, label: 'This Month' },
            { value: `R${stats.averagePerTrip.toFixed(0)}`, label: 'Avg / Trip' },
          ].map((s, i, arr) => (
            <View key={s.label} style={{ flexDirection: 'row', flex: 1 }}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </View>
          ))}
        </Card>

        {/* Trust score */}
        <View style={styles.sectionPx}>
          <Text style={styles.sectionLabel}>TRUST SCORE</Text>
          <Card style={{ ...styles.trustCard, borderLeftWidth: 4, borderLeftColor: trustColor }}>
            <View style={styles.trustTop}>
              <View style={[styles.trustScoreWrap, { backgroundColor: trustBg }]}>
                <Text style={[styles.trustScore, { color: trustColor }]}>{trustScore}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.trustLabel}>{trustLabel}</Text>
                <TouchableOpacity onPress={() => router.push('/loan-history' as any)}>
                  <Text style={styles.trustLink}>View loan history →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>

        {/* Transit balances */}
        <View style={styles.sectionPx}>
          <Text style={styles.sectionLabel}>TRANSIT BALANCES</Text>
          <View style={styles.balanceRow}>
            <Card style={styles.balanceCard}>
              <View style={styles.balanceIconWrap}>
                <Text style={{ fontSize: 22 }}>🚍</Text>
              </View>
              <Text style={styles.balanceCardLabel}>Rea Vaya Points</Text>
              <Text style={styles.balanceCardValue}>{profile?.reaVayaPoints ?? 0}</Text>
              <TouchableOpacity onPress={() => router.push('/rea-vaya/buy-points' as any)}>
                <Text style={styles.balanceTopUp}>Top up →</Text>
              </TouchableOpacity>
            </Card>
            <Card style={styles.balanceCard}>
              <View style={[styles.balanceIconWrap, { backgroundColor: '#EDE9FE' }]}>
                <Text style={{ fontSize: 22 }}>🚌</Text>
              </View>
              <Text style={styles.balanceCardLabel}>Metrobus</Text>
              <Text style={styles.balanceCardValue}>R{(profile?.metrobusBalance ?? 0).toFixed(2)}</Text>
              <TouchableOpacity onPress={() => router.push('/metrobus/top-up' as any)}>
                <Text style={styles.balanceTopUp}>Top up →</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.sectionPx}>
          <Text style={styles.sectionLabel}>SETTINGS</Text>
          <Card style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: COLORS.primaryLight }]}>
                  <Text style={{ fontSize: 15 }}>🔔</Text>
                </View>
                <Text style={styles.settingText}>Push Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingDivider} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: COLORS.accentLight }]}>
                  <Text style={{ fontSize: 15 }}>📍</Text>
                </View>
                <Text style={styles.settingText}>Location Services</Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={handleToggleLocation}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>
          </Card>
        </View>

        {/* Driver tools */}
        <View style={styles.sectionPx}>
          <Text style={styles.sectionLabel}>DRIVER TOOLS</Text>
          <Card>
            {/* Taxi Driver Card – using new TAXI_DRIVERS collection */}
            <DriverCard
              icon="🚖"
              title="Taxi Driver"
              loading={taxiDriverLoading}
              status={taxiStatus}
              onRegister={() => router.push('/taxi/hub')}
              onDashboard={() => router.push('/driver/minibus-taxi/dashboard')}
              onReapply={() => router.push('/driver/taxi/hub')}
            />
            <View style={{ height: 1, backgroundColor: COLORS.border }} />
            {/* School Driver Card – unchanged */}
            <DriverCard
              icon="🏫"
              title="School Transport Driver"
              loading={schoolDriverLoading}
              status={schoolDriver ? schoolDriver.verificationStatus : null}
              onRegister={() => router.push('/driver/school/apply')}
              onDashboard={() => router.push('/driver/school/')}
              onReapply={() => router.push('/driver/school/apply')}
            />
          </Card>
        </View>

        {/* Menu */}
        <View style={styles.sectionPx}>
          <Text style={styles.sectionLabel}>MORE</Text>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {menuItems.map((item, idx) => (
              <View key={item.label}>
                <MenuItem icon={item.icon} label={item.label} onPress={() => router.push(item.route as any)} />
              </View>
            ))}
          </Card>
        </View>

        {/* App version + sign out */}
        <View style={styles.footer}>
          <Text style={styles.appVersion}>myMetro v1.0.0</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ─── Edit Profile Modal ──────────────── */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {[
              { key: 'firstName', label: 'First Name', placeholder: 'First name' },
              { key: 'lastName', label: 'Last Name', placeholder: 'Last name' },
              { key: 'phone', label: 'Phone', placeholder: '0712345678', keyboard: 'phone-pad' as const },
              { key: 'address', label: 'Address', placeholder: 'Street address' },
              { key: 'city', label: 'City', placeholder: 'City' },
              { key: 'province', label: 'Province', placeholder: 'Province' },
              { key: 'postalCode', label: 'Postal Code', placeholder: '0000', keyboard: 'numeric' as const },
            ].map(field => (
              <View key={field.key} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  value={(editForm as any)[field.key]}
                  onChangeText={t => setEditForm(f => ({ ...f, [field.key]: t }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={field.keyboard ?? 'default'}
                />
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 48 },

  pageHeader: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pageTitle: { ...TYPOGRAPHY.h1 },

  // Hero
  heroSection: {
    backgroundColor: COLORS.surface, alignItems: 'center',
    paddingVertical: SPACING.xl, paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: COLORS.primaryLight,
    marginBottom: SPACING.md, overflow: 'hidden',
  },
  avatar: { flex: 1, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  heroName: { ...TYPOGRAPHY.h2, marginBottom: 4 },
  heroEmail: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: 2 },
  heroPhone: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.md },
  editBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, paddingVertical: 7,
  },
  editBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  // Stats
  statsCard: { flexDirection: 'row', marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...TYPOGRAPHY.h2, color: COLORS.primary },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  sectionPx: { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },

  // Trust
  trustCard: {},
  trustTop: { flexDirection: 'row', alignItems: 'center' },
  trustScoreWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  trustScore: { fontSize: 24, fontWeight: '800' },
  trustLabel: { ...TYPOGRAPHY.body, fontSize: 13, marginBottom: 4 },
  trustLink: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Balances
  balanceRow: { flexDirection: 'row', gap: SPACING.sm },
  balanceCard: { flex: 1, alignItems: 'center', padding: SPACING.md },
  balanceIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  balanceCardLabel: { ...TYPOGRAPHY.caption, marginBottom: 4 },
  balanceCardValue: { ...TYPOGRAPHY.h3, color: COLORS.primary, marginBottom: SPACING.xs },
  balanceTopUp: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Settings
  settingsCard: { padding: 0, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingText: { ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  settingDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  // Footer
  footer: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.md },
  appVersion: { ...TYPOGRAPHY.caption },
  signOutBtn: { backgroundColor: COLORS.errorLight, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.xl, paddingVertical: 12 },
  signOutBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 15 },

  // Edit modal
  modalContainer: { flex: 1, backgroundColor: COLORS.surface },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalCancel: { fontSize: 16, color: COLORS.textMuted },
  modalTitle: { ...TYPOGRAPHY.h3 },
  modalSave: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  modalBody: { flex: 1, padding: SPACING.md },
  inputGroup: { marginBottom: SPACING.md },
  inputLabel: { ...TYPOGRAPHY.label, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 13,
    fontSize: 15, color: COLORS.textPrimary,
  },
});