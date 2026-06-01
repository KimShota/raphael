import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  AudioSession,
  LiveKitRoom,
  useRoomContext,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/react-native";
import { API_URL } from "./config";

type VoiceRoomProps = {
  userId: string;
  buddyName: string;
  onDisconnected: () => void;
  onTranscript?: (role: "user" | "assistant", text: string) => void;
};

type ConnectionDetails = {
  token: string;
  url: string;
  roomName: string;
};

function VoiceSession({
  buddyName,
  onLeave,
}: {
  buddyName: string;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const { state, audioTrack } = useVoiceAssistant();

  useEffect(() => {
    const start = async () => {
      await AudioSession.startAudioSession();
    };
    start();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  const statusLabel =
    state === "listening"
      ? "Listening…"
      : state === "thinking"
        ? `${buddyName} is thinking…`
        : state === "speaking"
          ? `${buddyName} is speaking…`
          : "Connecting…";

  return (
    <View style={voiceStyles.session}>
      <View style={voiceStyles.visualizer}>
        {audioTrack ? (
          <BarVisualizer
            state={state}
            trackRef={audioTrack}
            barCount={5}
            style={voiceStyles.bars}
          />
        ) : (
          <ActivityIndicator size="large" color="#2563eb" />
        )}
      </View>
      <Text style={voiceStyles.status}>{statusLabel}</Text>
      <Text style={voiceStyles.hint}>Speak naturally — no need to press record.</Text>
      <Pressable
        style={voiceStyles.leaveBtn}
        onPress={() => {
          room.disconnect();
          onLeave();
        }}
      >
        <Text style={voiceStyles.leaveText}>End voice chat</Text>
      </Pressable>
    </View>
  );
}

export default function VoiceRoom({
  userId,
  buddyName,
  onDisconnected,
}: VoiceRoomProps) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);

  const fetchToken = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/livekit/token?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get LiveKit token");
      }
      setDetails({ token: data.token, url: data.url, roomName: data.roomName });
      setConnect(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  }, [userId]);

  if (!details && !error) {
    return (
      <View style={voiceStyles.wrap}>
        <Pressable style={voiceStyles.startBtn} onPress={fetchToken}>
          <Text style={voiceStyles.startText}>Start voice with {buddyName}</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={voiceStyles.wrap}>
        <Text style={voiceStyles.error}>{error}</Text>
        <Pressable style={voiceStyles.startBtn} onPress={fetchToken}>
          <Text style={voiceStyles.startText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!details) return null;

  return (
    <LiveKitRoom
      serverUrl={details.url}
      token={details.token}
      connect={connect}
      audio
      video={false}
      onDisconnected={() => {
        setConnect(false);
        setDetails(null);
        onDisconnected();
      }}
    >
      <VoiceSession
        buddyName={buddyName}
        onLeave={() => {
          setConnect(false);
          setDetails(null);
          onDisconnected();
        }}
      />
    </LiveKitRoom>
  );
}

const voiceStyles = StyleSheet.create({
  wrap: { padding: 12, borderTopWidth: 1, borderColor: "#eee" },
  startBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  startText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#dc2626", marginBottom: 10, fontSize: 13 },
  session: { padding: 12, alignItems: "center", borderTopWidth: 1, borderColor: "#eee" },
  visualizer: { height: 80, width: "100%", justifyContent: "center", alignItems: "center" },
  bars: { width: "80%", height: 60 },
  status: { fontSize: 15, fontWeight: "600", color: "#374151", marginTop: 8 },
  hint: { fontSize: 12, color: "#888", marginTop: 4, marginBottom: 12 },
  leaveBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  leaveText: { color: "#fff", fontWeight: "600" },
});
