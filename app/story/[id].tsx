import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { writeSharedStoryRequest } from '../lib/sharedStory';

// Target of shared story links (https://www.praxismedia.us/story/ID via
// universal links, and praxis://story/ID). Hands the article off to the Feed,
// which seats it at the top of the deck.
export default function SharedStoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) writeSharedStoryRequest(id);
    router.replace('/');
  }, [id]);

  return (
    <View style={s.container}>
      <ActivityIndicator color="#8EAF72" />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3EA' },
});
