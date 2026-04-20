import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function EditProfileModal() {
  const { profile, refreshProfile, user } = useAuth();
  const { c, Radius } = useTheme();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose an image under 2MB.');
      return;
    }
    setAvatarUri(asset.uri);
  };

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `avatars/${user!.id}/${Date.now()}.${ext}`;

      // Delete old avatar
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/storage/v1/object/public/avatars/')[1];
        if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      }

      const { error } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: `image/${ext}`,
        upsert: true,
      });
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let newAvatarUrl = profile?.avatar_url ?? null;
      if (avatarUri && avatarUri !== profile?.avatar_url) {
        newAvatarUrl = await uploadAvatar(avatarUri);
      }
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), bio: bio.trim(), avatar_url: newAvatarUrl })
        .eq('id', user!.id);
      if (error) throw error;
      await refreshProfile();
      router.back();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.cancel, { color: c.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: c.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || uploading}>
          {saving || uploading
            ? <ActivityIndicator color={c.tint} size="small" />
            : <Text style={[s.save, { color: c.tint }]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={pickAvatar}>
            <View style={[s.avatar, { backgroundColor: c.secondary }]}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={s.avatarImg} />
                : <Text style={[s.avatarInitial, { color: c.text }]}>
                    {(profile?.full_name ?? '?')[0]?.toUpperCase()}
                  </Text>
              }
              <View style={[s.avatarOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                <Text style={s.avatarOverlayText}>Edit</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={[s.avatarHint, { color: c.textMuted }]}>Max 2MB · Square images work best</Text>
        </View>

        {/* Fields */}
        <View style={s.fields}>
          <View>
            <Text style={[s.label, { color: c.textSecondary }]}>Display Name</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={c.textMuted}
            />
          </View>
          <View>
            <Text style={[s.label, { color: c.textSecondary }]}>Bio</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people a bit about yourself..."
              placeholderTextColor={c.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0,
  },
  cancel: { fontSize: 16 },
  title: { fontSize: 16, fontWeight: '600' },
  save: { fontSize: 16, fontWeight: '600' },
  content: { padding: 24, gap: 28 },
  avatarSection: { alignItems: 'center', gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 96, height: 96 },
  avatarInitial: { fontSize: 36, fontWeight: '700' },
  avatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 32, alignItems: 'center', justifyContent: 'center',
  },
  avatarOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  avatarHint: { fontSize: 12 },
  fields: { gap: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  textarea: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 22 },
});
