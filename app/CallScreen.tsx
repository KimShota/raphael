import { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Animated,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import {
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/react-native";
import { API_URL } from "./config";

type Msg = { role: "user" | "assistant"; content: string };
type Phrase = { id: number; text: string; meaning: string; example: string };

type Props = {
  buddyName: string;
  phrases: Phrase[];
  userId: string;
  onLeave: () => void;
};

export default function CallScreen({ buddyName, phrases, userId, onLeave }: Props) {
  const room = useRoomContext();
  const { state } = useVoiceAssistant();
  const [messages, setMessages] = useState<Msg[]>([]);

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.35)).current;
  const flatListRef = useRef<FlatList>(null);


  // Animate the avatar ring based on voice state
  useEffect(() => {
    pulseScale.stopAnimation();
    pulseOpacity.stopAnimation();

    const configs: Record<string, { scale: number; opacity: number; duration: number }> = {
      speaking:  { scale: 1.28, opacity: 0.88, duration: 480 },
      listening: { scale: 1.06, opacity: 0.55, duration: 1600 },
      thinking:  { scale: 1.14, opacity: 0.65, duration: 900 },
    };
    const cfg = configs[state] ?? { scale: 1.04, opacity: 0.30, duration: 1500 };

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: cfg.scale, duration: cfg.duration, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: cfg.opacity, duration: cfg.duration, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.0, duration: cfg.duration, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.18, duration: cfg.duration, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  // Poll /history every 2.5 s for live transcripts
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/history?userId=${userId}`);
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages(data.messages);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [userId]);

  function handleLeave() {
    room.disconnect();
    onLeave();
  }

  const statusLabel =
    state === "listening" ? "Listening…"
    : state === "thinking" ? `${buddyName} is thinking…`
    : state === "speaking" ? `${buddyName} is speaking…`
    : "Connecting…";

  const initial = buddyName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={cs.root}>
      {/* ── Header ── */}
      <View style={cs.header}>
        <TouchableOpacity style={cs.endBtn} onPress={handleLeave} activeOpacity={0.8}>
          <Text style={cs.endBtnIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={cs.headerTitle}>On a call with {buddyName}</Text>
        <View style={cs.headerSpacer} />
      </View>

      {/* ── Today's missions ── */}
      {phrases.length > 0 && (
        <View style={cs.missionsWrap}>
          <Text style={cs.missionsLabel}>TODAY'S MISSIONS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={cs.pillsRow}
          >
            {phrases.map((p) => (
              <View key={p.id} style={cs.pill}>
                <Text style={cs.pillText}>📌 {p.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Animated avatar ── */}
      <View style={cs.avatarSection}>
        <View style={cs.avatarWrap}>
          <Animated.View
            style={[
              cs.avatarRing,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <View style={cs.avatarCircle}>
            <Text style={cs.avatarInitial}>{initial}</Text>
          </View>
        </View>
        <Text style={cs.statusLabel}>{statusLabel}</Text>
      </View>

      {/* ── Live chat bubbles ── */}
      <View style={cs.chatPanel}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={cs.chatContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[cs.bubble, item.role === "user" ? cs.userBubble : cs.theoBubble]}>
              <Text style={[cs.bubbleText, item.role === "user" && cs.userBubbleText]}>
                {item.content}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={cs.emptyHint}>Your conversation will appear here…</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const BLUE = "#1d4ed8";

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLUE },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  endBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  endBtnIcon: { color: "#fff", fontSize: 15, fontWeight: "700" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    fontWeight: "600",
  },
  headerSpacer: { width: 40 },

  // Missions
  missionsWrap: { paddingHorizontal: 20, marginBottom: 8 },
  missionsLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  pillsRow: { flexDirection: "row", gap: 8 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  pillText: { color: "#fff", fontSize: 13, fontWeight: "500" },

  // Avatar
  avatarSection: {
    alignItems: "center",
    paddingVertical: 28,
  },
  avatarWrap: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.38)",
  },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarInitial: { fontSize: 50, fontWeight: "800", color: BLUE },
  statusLabel: {
    marginTop: 16,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Chat panel
  chatPanel: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  chatContent: { padding: 16, paddingTop: 20, paddingBottom: 16 },
  bubble: {
    maxWidth: "80%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginVertical: 3,
  },
  theoBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: BLUE,
    borderBottomRightRadius: 5,
  },
  bubbleText: { fontSize: 15, color: "#1e293b", lineHeight: 21 },
  userBubbleText: { color: "#fff" },
  emptyHint: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 40,
    lineHeight: 22,
  },
});
