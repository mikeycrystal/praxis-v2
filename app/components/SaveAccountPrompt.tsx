import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { buildHref } from '../lib/buildHref';

type SaveAccountPromptProps = {
  visible: boolean;
  feature?: 'saved' | 'search';
  returnTo: string;
  onClose: () => void;
};

export function SaveAccountPrompt({
  visible,
  feature = 'saved',
  returnTo,
  onClose,
}: SaveAccountPromptProps) {
  const isSaved = feature === 'saved';
  const title = isSaved ? 'Save stories for later' : 'Search Praxis';
  const body = isSaved
    ? 'Create a free account or sign in to save articles and keep them synced across your devices.'
    : 'Create a free account or sign in to search Praxis and keep your results connected to your account.';
  const openAuth = (route: '/login' | '/register') => {
    onClose();
    router.push(buildHref(route, { returnTo }));
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close save account prompt"
        />
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons name={isSaved ? 'bookmark-outline' : 'search-outline'} size={24} color="#6B9456" />
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>
          <TouchableOpacity
            style={s.primaryButton}
            onPress={() => openAuth('/register')}
            accessibilityRole="button"
          >
            <Text style={s.primaryText}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.secondaryButton}
            onPress={() => openAuth('/login')}
            accessibilityRole="button"
          >
            <Text style={s.secondaryText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.notNowButton} onPress={onClose} accessibilityRole="button">
            <Text style={s.notNowText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(28, 25, 20, 0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DED4C4',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: '#211E19',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 18,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4E6',
  },
  title: { marginTop: 14, color: '#2E2A25', fontSize: 20, fontWeight: '800' },
  body: { marginTop: 7, color: '#71695F', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: {
    width: '100%',
    height: 48,
    marginTop: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8DAE73',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    width: '100%',
    height: 48,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8CEBE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
  },
  secondaryText: { color: '#39342E', fontSize: 15, fontWeight: '700' },
  notNowButton: { paddingHorizontal: 16, paddingVertical: 11, marginTop: 4 },
  notNowText: { color: '#81786E', fontSize: 13, fontWeight: '600' },
});
