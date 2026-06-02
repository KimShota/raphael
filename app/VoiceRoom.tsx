import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import { LiveKitRoom } from "@livekit/react-native";
import { API_URL } from "./config";
import CallScreen from "./CallScreen";

type Phrase = { id: number; text: string; meaning: string; example: string };

type VoiceRoomProps = {
  userId: string;
  buddyName: string;
  phrases: Phrase[];
  onDisconnected: () => void;
};

type ConnectionDetails = { token: string; url: string; roomName: string };

export default function VoiceRoom({
  userId,
  buddyName,
  phrases,
  onDisconnected,
}: VoiceRoomProps) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCall = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch(
        `${API_URL}/livekit/token?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get token");
      setDetails({ token: data.token, url: data.url, roomName: data.roomName });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [userId]);

  function handleLeave() {
    setDetails(null);
    onDisconnected();
  }

  return (
    <>
      {/* ── Start call button (shown on chat screen) ── */}
      <View style={vs.wrap}>
        {error && <Text style={vs.error}>{error}</Text>}
        <Pressable
          style={[vs.callBtn, connecting && vs.callBtnDisabled]}
          onPress={startCall}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={vs.callIcon}>🎙️</Text>
              <Text style={vs.callText}>Start voice with {buddyName}</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Full-screen call modal ── */}
      <Modal
        visible={!!details}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleLeave}
      >
        {details && (
          <LiveKitRoom
            serverUrl={details.url}
            token={details.token}
            connect
            audio
            video={false}
            onDisconnected={handleLeave}
          >
            <CallScreen
              buddyName={buddyName}
              phrases={phrases}
              userId={userId}
              onLeave={handleLeave}
            />
          </LiveKitRoom>
        )}
      </Modal>
    </>
  );
}

const vs = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8, textAlign: "center" },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16a34a",
    borderRadius: 16,
    paddingVertical: 14,
  },
  callBtnDisabled: { opacity: 0.65 },
  callIcon: { fontSize: 18 },
  callText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
