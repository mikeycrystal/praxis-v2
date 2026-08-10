import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  copyPraxisStoryLink,
  openPraxisStoryMessage,
  type ShareableArticle,
} from '../lib/shareArticle';

type StoryShareSheetProps = { article: ShareableArticle | null; visible: boolean; onClose: () => void };

export function StoryShareSheet({ article, visible, onClose }: StoryShareSheetProps) {
  if (!article) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Share story</Text>
          <Text style={s.subtitle}>Share this story and help friends see the full picture.</Text>
          <View style={s.preview}>
            <View style={s.previewMark}><Text style={s.previewMarkText}>P</Text></View>
            <View style={s.previewCopy}>
              <Text style={s.previewEyebrow}>SHARED FROM PRAXIS</Text>
              <Text style={s.previewTitle} numberOfLines={2}>{article.title}</Text>
              <Text style={s.previewMeta} numberOfLines={1}>{article.publisher?.name ?? 'Praxis story'} · Opens in Praxis</Text>
            </View>
          </View>
          <View style={s.actions}>
            <TouchableOpacity style={s.action} onPress={() => void copyPraxisStoryLink(article).then(onClose)} accessibilityLabel="Copy Praxis story link">
              <View style={[s.actionIcon, { backgroundColor: '#302C27' }]}><Ionicons name="link-outline" size={27} color="#FFFDF9" /></View><Text style={s.actionLabel}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.action} onPress={() => { onClose(); void openPraxisStoryMessage(article); }} accessibilityLabel="Open Messages with Praxis story">
              <View style={[s.actionIcon, { backgroundColor: '#58B85B' }]}><Ionicons name="chatbubble-outline" size={26} color="#FFFDF9" /></View><Text style={s.actionLabel}>Messages</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.cancel} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28, 25, 20, 0.42)' }, sheet: { backgroundColor: '#F7F2E8', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 }, handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: '#D6CEC0', alignSelf: 'center', marginBottom: 20 },
  title: { color: '#2E2A25', fontSize: 22, fontWeight: '800' }, subtitle: { color: '#6D655C', fontSize: 14, lineHeight: 20, marginTop: 5 }, preview: { marginTop: 18, borderWidth: 1, borderColor: '#DDD1BF', borderRadius: 18, backgroundColor: '#FFFDF9', padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }, previewMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#8EAF72', alignItems: 'center', justifyContent: 'center' }, previewMarkText: { color: '#FFFDF9', fontSize: 22, fontWeight: '900' }, previewCopy: { flex: 1 }, previewEyebrow: { color: '#8EAF72', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, previewTitle: { color: '#2E2A25', fontSize: 14, fontWeight: '800', lineHeight: 19, marginTop: 3 }, previewMeta: { color: '#837A6F', fontSize: 11, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 22 }, action: { flex: 1, alignItems: 'center', gap: 8 }, actionIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }, actionLabel: { color: '#2E2A25', fontSize: 12, fontWeight: '700' }, cancel: { height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#D6CEC0', backgroundColor: '#FFFDF9', alignItems: 'center', justifyContent: 'center', marginTop: 25 }, cancelText: { color: '#2E2A25', fontSize: 16, fontWeight: '700' },
});
