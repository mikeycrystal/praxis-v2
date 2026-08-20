import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const colors = {
  // Matches the web Profile Edit modal's light surface, not the page backdrop.
  background: '#FFFCF6',
  card: '#FFFCF6',
  text: '#3B342E',
  muted: '#7A7269',
  border: '#DED6C9',
  primary: '#8EAF78',
  primaryPressed: '#71955B',
  avatar: '#E4E0D8',
};

export default function EditProfileModal() {
  const { profile, refreshProfile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [newAvatarBase64, setNewAvatarBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access in Settings to choose a profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      // Native file:// URIs are not reliable upload bodies for Supabase.
      // ImagePicker provides JPEG base64 data that we turn into an ArrayBuffer.
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose an image under 2MB.');
      return;
    }
    if (!asset.base64) {
      Alert.alert('Could not read image', 'Please choose another photo and try again.');
      return;
    }
    setAvatarUri(asset.uri);
    setNewAvatarBase64(asset.base64);
  };

  const uploadAvatar = async (base64: string): Promise<string> => {
    setUploading(true);
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const path = `${user!.id}/${Date.now()}.jpg`;

      const { error } = await supabase.storage.from('avatars').upload(path, bytes.buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }

    setSaving(true);
    try {
      let newAvatarUrl = profile?.avatar_url ?? null;
      if (newAvatarBase64) {
        newAvatarUrl = await uploadAvatar(newAvatarBase64);
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          avatar_url: newAvatarUrl,
        })
        .eq('id', user!.id);
      if (error) throw error;

      // Keep the old image until the replacement and profile update both
      // succeed, so a failed upload never erases a person's existing photo.
      if (newAvatarBase64 && profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/storage/v1/object/public/avatars/')[1];
        if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      }
      await refreshProfile();
      router.back();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Edit Profile</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.closeButton} accessibilityLabel="Close edit profile">
          <Text style={s.closeText}>×</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={s.avatarSection}>
            <View style={s.avatar}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={s.avatarImg} />
                : <Text style={s.avatarInitial}>{(fullName || '?')[0]?.toUpperCase()}</Text>
              }
            </View>
            <TouchableOpacity onPress={pickAvatar} disabled={uploading} style={s.uploadButton}>
              {uploading
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <>
                    <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                    <Text style={s.uploadButtonText}>Upload new picture</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={s.fields}>
            <View>
              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={colors.muted}
                maxLength={100}
              />
            </View>
            <View>
              <Text style={s.label}>Username</Text>
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                maxLength={30}
              />
            </View>
            <View>
              <Text style={s.label}>Bio</Text>
              <TextInput
                style={s.textarea}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={s.characterCount}>{bio.length}/500</Text>
            </View>
          </View>

          <View style={s.actions}>
            <TouchableOpacity onPress={() => router.back()} disabled={saving} style={s.cancelButton}>
              <Text style={s.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving || uploading} style={[s.saveButton, (saving || uploading) && s.saveButtonDisabled]}>
              {saving
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Text style={s.saveButtonText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 6,
  },
  closeButton: { width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  closeText: { color: colors.muted, fontSize: 34, fontWeight: '300', lineHeight: 36 },
  title: { color: colors.text, fontSize: 25, fontWeight: '700' },
  keyboardArea: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 40, gap: 36 },
  avatarSection: { alignItems: 'center', gap: 26 },
  avatar: { width: 128, height: 128, borderRadius: 64, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.avatar },
  avatarImg: { width: 128, height: 128 },
  avatarInitial: { color: colors.text, fontSize: 42, fontWeight: '400' },
  uploadButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  uploadButtonText: { color: colors.primary, fontSize: 18, fontWeight: '500' },
  fields: { gap: 24 },
  label: { color: colors.text, fontSize: 18, fontWeight: '500', marginBottom: 14 },
  input: { height: 58, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 22, color: colors.text, fontSize: 18 },
  textarea: { minHeight: 140, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 22, color: colors.text, fontSize: 18, lineHeight: 25 },
  characterCount: { color: colors.muted, textAlign: 'right', fontSize: 16, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingTop: 8 },
  cancelButton: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 26, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.card },
  cancelButtonText: { color: colors.text, fontSize: 18, fontWeight: '500' },
  saveButton: { minHeight: 54, minWidth: 170, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, borderRadius: 22, backgroundColor: colors.primary },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '500' },
});
