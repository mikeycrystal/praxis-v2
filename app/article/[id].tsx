import { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Linking, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface Comment {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { c, Radius } = useTheme();
  const [article, setArticle] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('article').select('*, publisher(name, domain)').eq('id', id).single(),
      user ? supabase.from('saved_articles').select('id').eq('user_id', user.id).eq('article_id', id).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from('likes').select('id').eq('user_id', user.id).eq('article_id', id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('article_id', id),
      supabase.from('comments').select('id, user_id, body, created_at, profiles(full_name, username, avatar_url)').eq('article_id', id).order('created_at', { ascending: true }),
    ]).then(([{ data: art }, { data: saved }, { data: liked }, { count }, { data: cmts }]) => {
      setArticle(art);
      setIsSaved(!!saved);
      setIsLiked(!!liked);
      setLikeCount(count ?? 0);
      setComments((cmts ?? []) as Comment[]);
      setLoading(false);
    });
  }, [id, user]);

  const toggleSave = async () => {
    if (!user) return;
    if (isSaved) {
      await supabase.from('saved_articles').delete().eq('user_id', user.id).eq('article_id', id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_articles').insert({ user_id: user.id, article_id: Number(id) });
      setIsSaved(true);
    }
  };

  const toggleLike = async () => {
    if (!user) return;
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('article_id', id);
      setIsLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('likes').insert({ user_id: user.id, article_id: Number(id) });
      setIsLiked(true);
      setLikeCount(c => c + 1);
    }
  };

  const submitComment = async () => {
    if (!user || !commentText.trim() || submittingComment) return;
    const text = commentText.trim();
    setCommentText('');
    setSubmittingComment(true);
    const { data } = await supabase
      .from('comments')
      .insert({ user_id: user.id, article_id: Number(id), body: text })
      .select('id, user_id, body, created_at, profiles(full_name, username, avatar_url)')
      .single();
    if (data) {
      setComments(prev => [...prev, data as Comment]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
    setSubmittingComment(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!article) return null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={[s.backText, { color: c.tint }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topActions}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/article/ai-analysis', params: { id } })}
            style={[s.topBtn, { backgroundColor: c.tint + '20' }]}
          >
            <Text style={{ fontSize: 16 }}>🧠</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLike} style={[s.topBtn, { backgroundColor: c.card }]}>
            <Text style={{ fontSize: 16 }}>{isLiked ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleSave} style={[s.topBtn, { backgroundColor: c.card }]}>
            <Text style={{ fontSize: 16 }}>{isSaved ? '🔖' : '🔗'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {article.image_url && (
            <Image
              source={{ uri: article.image_url }}
              style={[s.heroImage, { borderRadius: Radius.xl }]}
              resizeMode="cover"
            />
          )}

          <View style={s.meta}>
            {article.topics?.[0] && (
              <View style={[s.catBadge, { backgroundColor: c.tint + '20', borderColor: c.tint + '40' }]}>
                <Text style={[s.catText, { color: c.tint }]}>{article.topics[0]}</Text>
              </View>
            )}
            <Text style={[s.title, { color: c.text }]}>{article.title}</Text>
            {article.lede && (
              <Text style={[s.lede, { color: c.textSecondary }]}>{article.lede}</Text>
            )}
            <Text style={[s.byline, { color: c.textMuted }]}>
              {article.publisher?.name ?? 'Unknown'}
              {article.byline ? ` · ${article.byline}` : ''}
              {' · '}
              {new Date(article.ts_pub).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>

          {/* Engagement row */}
          <View style={[s.engRow, { borderColor: c.border }]}>
            <TouchableOpacity style={s.engBtn} onPress={toggleLike}>
              <Text style={{ fontSize: 18 }}>{isLiked ? '❤️' : '🤍'}</Text>
              <Text style={[s.engCount, { color: c.textMuted }]}>{likeCount}</Text>
            </TouchableOpacity>
            <View style={[s.engDivider, { backgroundColor: c.border }]} />
            <View style={s.engBtn}>
              <Text style={{ fontSize: 18 }}>💬</Text>
              <Text style={[s.engCount, { color: c.textMuted }]}>{comments.length}</Text>
            </View>
          </View>

          {article.body ? (
            <Text style={[s.body, { color: c.text }]}>{article.body}</Text>
          ) : (
            <TouchableOpacity
              style={[s.readFullBtn, { backgroundColor: c.tint }]}
              onPress={() => Linking.openURL(article.url)}
            >
              <Text style={[s.readFullBtnText, { color: c.tintForeground }]}>Read Full Article ↗</Text>
            </TouchableOpacity>
          )}

          {/* Comments section */}
          <View style={s.commentsSection}>
            <Text style={[s.commentsTitle, { color: c.text }]}>
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            {comments.length === 0 && (
              <Text style={[s.noComments, { color: c.textMuted }]}>Be the first to comment.</Text>
            )}
            {comments.map(comment => {
              const name = comment.profiles?.full_name ?? comment.profiles?.username ?? 'Anonymous';
              const initial = name[0]?.toUpperCase() ?? '?';
              return (
                <View key={comment.id} style={[s.commentRow, { borderColor: c.border }]}>
                  <View style={[s.commentAvatar, { backgroundColor: c.secondary }]}>
                    <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.commentName, { color: c.text }]}>{name}</Text>
                    <Text style={[s.commentBody, { color: c.textSecondary }]}>{comment.body}</Text>
                    <Text style={[s.commentTime, { color: c.textMuted }]}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Comment input + CTA */}
        <View style={[s.bottomBar, { backgroundColor: c.background, borderTopColor: c.border }]}>
          <View style={s.commentInput}>
            <TextInput
              style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              placeholder="Add a comment..."
              placeholderTextColor={c.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              returnKeyType="send"
              onSubmitEditing={submitComment}
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: commentText.trim() ? c.tint : c.secondary }]}
              onPress={submitComment}
              disabled={!commentText.trim() || submittingComment}
            >
              <Text style={{ color: commentText.trim() ? c.tintForeground : c.textMuted, fontSize: 16 }}>↑</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: c.tint }]}
            onPress={() => Linking.openURL(article.url)}
          >
            <Text style={[s.ctaBtnText, { color: c.tintForeground }]}>Read Full Article ↗</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 17 },
  topActions: { flexDirection: 'row', gap: 8 },
  topBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 16 },
  heroImage: { width: '100%', aspectRatio: 16 / 9 },
  meta: { gap: 10 },
  catBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 31 },
  lede: { fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  byline: { fontSize: 12 },
  engRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  engBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  engCount: { fontSize: 14, fontWeight: '600' },
  engDivider: { width: 1, height: 24 },
  body: { fontSize: 16, lineHeight: 26 },
  readFullBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  readFullBtnText: { fontSize: 16, fontWeight: '600' },
  commentsSection: { gap: 12 },
  commentsTitle: { fontSize: 17, fontWeight: '700' },
  noComments: { fontSize: 13 },
  commentRow: { flexDirection: 'row', gap: 10, paddingBottom: 12, borderBottomWidth: 1 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  commentName: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  commentBody: { fontSize: 14, lineHeight: 20 },
  commentTime: { fontSize: 11, marginTop: 3 },
  bottomBar: { borderTopWidth: 1, padding: 12, gap: 8 },
  commentInput: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '700' },
});
