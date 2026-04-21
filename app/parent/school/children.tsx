// app/parent/school/children.tsx
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, ActivityIndicator, ScrollView,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query, ID } from '@/lib/appwrite';
import { fetchSchoolAutocomplete, PlacePrediction } from '@/lib/google-places';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState } from '@/components/ui';

interface Child {
  $id: string;
  parentId: string;
  name: string;
  school?: string;
  grade?: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

const GRADES = ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export default function ChildrenScreen() {
  const { user } = useUser();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', school: '', grade: '', birthDate: '', notes: '' });

  const [schoolPredictions, setSchoolPredictions] = useState<PlacePrediction[]>([]);
  const [showSchoolPredictions, setShowSchoolPredictions] = useState(false);
  // FIX: useRef for debounce
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadChildren = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHILDREN, [
        Query.equal('parentId', user!.id),
        Query.orderDesc('createdAt'),
      ]);
      setChildren(res.documents as unknown as Child[]);
    } catch {
      Alert.alert('Error', 'Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadChildren(); }, []));

  const onSchoolTextChange = (text: string) => {
    setForm(f => ({ ...f, school: text }));
    if (text.length < 2) { setSchoolPredictions([]); setShowSchoolPredictions(false); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const results = await fetchSchoolAutocomplete(text);
      setSchoolPredictions(results);
      setShowSchoolPredictions(results.length > 0);
    }, 300);
  };

  const onSelectSchool = (prediction: PlacePrediction) => {
    setShowSchoolPredictions(false);
    setForm(f => ({ ...f, school: prediction.description }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Name required', 'Please enter your child\'s name.'); return; }
    setSubmitting(true);
    try {
      const data = {
        parentId: user!.id,
        name: form.name.trim(),
        school: form.school.trim() || null,
        grade: form.grade.trim() || null,
        birthDate: form.birthDate || null,
        notes: form.notes.trim() || null,
        createdAt: editingChild?.createdAt ?? new Date().toISOString(),
      };
      if (editingChild) {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.CHILDREN, editingChild.$id, data);
      } else {
        await databases.createDocument(DATABASE_ID, COLLECTIONS.CHILDREN, ID.unique(), data);
      }
      setModalVisible(false);
      resetForm();
      loadChildren();
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (child: Child) => {
    Alert.alert(`Delete ${child.name}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.CHILDREN, child.$id);
            loadChildren();
          } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  };

  const openAdd = () => { setEditingChild(null); resetForm(); setModalVisible(true); };
  const openEdit = (child: Child) => {
    setEditingChild(child);
    setForm({ name: child.name, school: child.school || '', grade: child.grade || '', birthDate: child.birthDate || '', notes: child.notes || '' });
    setModalVisible(true);
  };
  const resetForm = () => setForm({ name: '', school: '', grade: '', birthDate: '', notes: '' });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarColors = ['#CCFBF1', '#FEF3C7', '#EDE9FE', '#FCE7F3', '#DBEAFE'];
  const avatarTextColors = [COLORS.primaryDark, COLORS.accentDark, '#7C3AED', '#BE185D', '#1D4ED8'];

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="My Children"
        onBack={() => router.back()}
        right={
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        }
      />

      {children.length === 0 ? (
        <EmptyState
          icon="👧"
          title="No children added yet"
          subtitle="Add your child's profile to start booking school transport"
          action="Add Child"
          onAction={openAdd}
        />
      ) : (
        <FlatList
          data={children}
          keyExtractor={item => item.$id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.childCount}>{children.length} child{children.length !== 1 ? 'ren' : ''}</Text>
          }
          renderItem={({ item, index }) => {
            const colorIdx = index % avatarColors.length;
            return (
              <Card style={styles.childCard} onPress={() => openEdit(item)}>
                <View style={styles.childTop}>
                  <View style={[styles.childAvatar, { backgroundColor: avatarColors[colorIdx] }]}>
                    <Text style={[styles.childAvatarText, { color: avatarTextColors[colorIdx] }]}>
                      {getInitials(item.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.childName}>{item.name}</Text>
                    {item.grade && <Text style={styles.childGrade}>{item.grade}</Text>}
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.childDetails}>
                  {item.school && (
                    <View style={styles.childDetail}>
                      <Text style={styles.childDetailIcon}>🏫</Text>
                      <Text style={styles.childDetailText} numberOfLines={1}>{item.school}</Text>
                    </View>
                  )}
                  {item.birthDate && (
                    <View style={styles.childDetail}>
                      <Text style={styles.childDetailIcon}>🎂</Text>
                      <Text style={styles.childDetailText}>{item.birthDate}</Text>
                    </View>
                  )}
                  {item.notes && (
                    <View style={styles.childDetail}>
                      <Text style={styles.childDetailIcon}>📝</Text>
                      <Text style={styles.childDetailText} numberOfLines={2}>{item.notes}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.editHint}>Tap to edit</Text>
              </Card>
            );
          }}
        />
      )}

      {/* Add/Edit modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingChild ? 'Edit Child' : 'Add Child'}</Text>

              <Text style={styles.fieldLabel}>Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder="e.g. Thabo"
                placeholderTextColor={COLORS.textMuted}
                autoFocus={!editingChild}
              />

              <Text style={styles.fieldLabel}>School <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={form.school}
                onChangeText={onSchoolTextChange}
                placeholder="Start typing school name..."
                placeholderTextColor={COLORS.textMuted}
              />
              {showSchoolPredictions && (
                <View style={styles.predictions}>
                  {schoolPredictions.map(p => (
                    <TouchableOpacity key={p.placeId} style={styles.predictionItem} onPress={() => onSelectSchool(p)}>
                      <Text style={styles.predictionText}>🏫 {p.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Grade <Text style={styles.optional}>(optional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradesScroll}>
                {GRADES.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeChip, form.grade === g && styles.gradeChipSelected]}
                    onPress={() => setForm(f => ({ ...f, grade: f.grade === g ? '' : g }))}
                  >
                    <Text style={[styles.gradeChipText, form.grade === g && styles.gradeChipTextSelected]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Date of Birth <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={form.birthDate}
                onChangeText={t => setForm(f => ({ ...f, birthDate: t }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.fieldLabel}>Medical notes / allergies <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.notes}
                onChangeText={t => setForm(f => ({ ...f, notes: t }))}
                placeholder="e.g. Allergic to peanuts, asthma inhaler in bag"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <PrimaryButton label="Cancel" variant="ghost" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
                <PrimaryButton label={editingChild ? 'Save Changes' : 'Add Child'} onPress={handleSave} loading={submitting} style={{ flex: 2 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  list: { padding: SPACING.md, paddingBottom: 40 },
  childCount: { ...TYPOGRAPHY.caption, marginBottom: SPACING.sm },

  childCard: { marginBottom: SPACING.sm },
  childTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  childAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontSize: 18, fontWeight: '800' },
  childName: { ...TYPOGRAPHY.h4 },
  childGrade: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 18 },
  childDetails: { gap: 6 },
  childDetail: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  childDetailIcon: { fontSize: 13, width: 20, marginTop: 1 },
  childDetailText: { ...TYPOGRAPHY.body, fontSize: 13, flex: 1 },
  editHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: SPACING.xs, textAlign: 'right' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { ...TYPOGRAPHY.h2, marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.sm },
  required: { color: COLORS.error },
  optional: { fontWeight: '400', color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary, marginBottom: SPACING.xs,
  },
  textArea: { height: 88, textAlignVertical: 'top' },
  predictions: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, marginBottom: SPACING.xs },
  predictionItem: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  predictionText: { ...TYPOGRAPHY.body },
  gradesScroll: { marginBottom: SPACING.xs },
  gradeChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: SPACING.xs, backgroundColor: COLORS.surface,
  },
  gradeChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  gradeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  gradeChipTextSelected: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.xs },
});