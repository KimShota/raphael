import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View, Text, TextInput, FlatList, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
  Modal, ScrollView, TouchableOpacity, ActivityIndicator,
  AppState, SafeAreaView,
} from "react-native";
import "react-native-get-random-values";
import * as Crypto from "expo-crypto";
import { AudioModule } from "expo-audio";
import { API_URL } from "./config";
import VoiceRoom from "./VoiceRoom";

type Msg = { role: "user" | "assistant"; content: string };
type Phrase = { id: number; text: string; meaning: string; example: string };

// define interests
const INTERESTS = ["Sports","Music","Gaming","Travel","Movies","Food","Tech","Fashion"];
// define levels 
const LEVELS = [
  { label: "Beginner", sub: "基礎レベル", value: "BEGINNER" },
  { label: "Intermediate", sub: "読み書きはできる", value: "LOWER-INTERMEDIATE" },
  { label: "Advanced", sub: "もっとナチュラルに", value: "UPPER-INTERMEDIATE" },
];

// function to display onboarding screen
function OnboardingScreen({ onDone }: { onDone: (buddyName: string, level: string, interests: string[]) => void }) {
  const [step, setStep] = useState(0);
  const [buddyName, setBuddyName] = useState("Theo");
  const [level, setLevel] = useState("LOWER-INTERMEDIATE");
  const [interests, setInterests] = useState<string[]>([]);

  // allow user to select interest
  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  return (
    <SafeAreaView style={ob.container}>
      {/* Step 0: Buddy name */}
      {step === 0 && (
        <View style={ob.step}>
          <Text style={ob.emoji}>👋</Text>
          <Text style={ob.title}>Welcome to Raphael</Text>
          <Text style={ob.sub}>Your AI English buddy is waiting.</Text>
          <Text style={ob.label}>What do you want to call your buddy?</Text>
          <TextInput
            style={ob.nameInput}
            value={buddyName}
            onChangeText={setBuddyName}
            placeholder="Theo"
            maxLength={20}
          />
          <TouchableOpacity style={ob.btn} onPress={() => setStep(1)}>
            <Text style={ob.btnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 1: Level */}
      {step === 1 && (
        <View style={ob.step}>
          <Text style={ob.emoji}>📊</Text>
          <Text style={ob.title}>Your English level?</Text>
          {LEVELS.map((l) => (
            <TouchableOpacity
              key={l.value}
              style={[ob.levelBtn, level === l.value && ob.levelBtnActive]}
              onPress={() => setLevel(l.value)}
            >
              <Text style={[ob.levelLabel, level === l.value && ob.levelLabelActive]}>{l.label}</Text>
              <Text style={ob.levelSub}>{l.sub}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={ob.btn} onPress={() => setStep(2)}>
            <Text style={ob.btnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 2: Interests */}
      {step === 2 && (
        <View style={ob.step}>
          <Text style={ob.emoji}>🎯</Text>
          <Text style={ob.title}>What are you into?</Text>
          <Text style={ob.sub}>Pick a few topics to talk about</Text>
          <View style={ob.grid}>
            {INTERESTS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[ob.chip, interests.includes(item) && ob.chipActive]}
                onPress={() => toggleInterest(item)}
              >
                <Text style={[ob.chipText, interests.includes(item) && ob.chipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[ob.btn, interests.length === 0 && { opacity: 0.5 }]}
            onPress={() => interests.length > 0 && onDone(buddyName, level, interests)}
          >
            <Text style={ob.btnText}>Let's go 🚀</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// main function 
export default function App() {
  const [appState, setAppState] = useState<"loading" | "onboarding" | "chat">("loading");
  const [userId, setUserId] = useState("");
  const [buddyName, setBuddyName] = useState("Theo");
  const [level, setLevel] = useState("LOWER-INTERMEDIATE");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [showMyPhrases, setShowMyPhrases] = useState(false);
  const [myPhrases, setMyPhrases] = useState<any[]>([]);

  const [voiceEnded, setVoiceEnded] = useState(0);

  // request mic permission — LiveKit handles the audio session automatically via registerGlobals()
  useEffect(() => {
    AudioModule.requestRecordingPermissionsAsync().then(({ granted }) => {
      if (!granted) alert("Microphone permission is required.");
    });
  }, []);

  // check if user is onboarded or not
  useEffect(() => {
    (async () => {
      // search if there is user id stored in local storage
      const uid = await AsyncStorage.getItem("userId");
      if (!uid) {
        setAppState("onboarding");
        return;
      }
      setUserId(uid);
      // get user info
      const res = await fetch(`${API_URL}/user?userId=${uid}`).then(r => r.json());
      // set buddy name and level
      if (res.user) {
        setBuddyName(res.user.buddy_name);
        setLevel(res.user.level);
      }
      setAppState("chat");
    })();
  }, []);

  // load chat when app state changes and user id is registered
  useEffect(() => {
    if (appState !== "chat" || !userId) return;
    (async () => {
      try {
        // get chat history
        const d = await fetch(`${API_URL}/history?userId=${userId}`).then(r => r.json());
        const msgs: Msg[] = d.messages ?? [];
        // set welcoming message
        if (msgs.length === 0) {
          const g = await fetch(`${API_URL}/greeting?userId=${userId}`).then(r => r.json());
          if (g.reply) setMessages([{ role: "assistant", content: g.reply }]);
        } else {
          setMessages(msgs);
        }
      } catch {}
    })();
    // set today's phrases
    fetch(`${API_URL}/todays-phrases`).then(r=>r.json()).then(d=>setPhrases(d.phrases??[])).catch(()=>{});
  }, [appState, userId, voiceEnded]);

  async function reloadHistory() {
    if (!userId) return;
    try {
      const d = await fetch(`${API_URL}/history?userId=${userId}`).then((r) => r.json());
      setMessages(d.messages ?? []);
    } catch {
      /* ignore */
    }
  }

  // end session if app goes into background
  useEffect(() => {
    if (appState !== "chat") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        fetch(`${API_URL}/end-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [appState, userId]);

  async function handleOnboardingDone(name: string, lvl: string, interests: string[]) {
    const uid = Crypto.randomUUID();
    await AsyncStorage.setItem("userId", uid);
    try {
      await fetch(`${API_URL}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, buddyName: name, level: lvl, interests }),
      });
    } catch (error){
      console.error(error); 
    }
    setUserId(uid);
    setBuddyName(name);
    setLevel(lvl);
    setAppState("chat");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, level, userId }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "(error)" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "(connection error)" }]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReview() {
    setFeedback(null);
    setLoadingReview(true);
    setShowReview(true);
    try {
      const res = await fetch(`${API_URL}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      setFeedback(d.feedback);
    } catch {}
    finally { setLoadingReview(false); }
  }

  // function to fetch phrases
  async function fetchMyPhrases() {
    const d = await fetch(`${API_URL}/my-phrases?userId=${userId}`).then(r => r.json());
    setMyPhrases(d.phrases ?? []);
    setShowMyPhrases(true);
  }
  
  // function to log out 
  async function logout(){
    await AsyncStorage.removeItem("userId"); 
    setUserId("");
    setMessages([]);
    setPhrases([]);
    setFeedback(null);
    setMyPhrases([]);
    setAppState("onboarding");
  }

  // ── Render ──
  if (appState === "loading") {
    return <View style={s.center}><ActivityIndicator color="#2563eb" size="large" /></View>;
  }
  if (appState === "onboarding") {
    return <OnboardingScreen onDone={handleOnboardingDone} />;
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Phrases card */}
      {phrases.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>今日のフレーズ — 使ってみよう</Text>
          {phrases.map((p) => (
            <View key={p.id} style={s.phraseRow}>
              <Text style={s.phraseText}>{p.text}</Text>
              <Text style={s.phraseMeaning}>{p.meaning}</Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === "user" ? s.userBubble : s.theoBubble]}>
            <Text style={[s.bubbleText, item.role === "user" && s.userText]}>{item.content}</Text>
          </View>
        )}
      />

      {loading && <Text style={s.typing}>{buddyName} is typing…</Text>}

      <VoiceRoom
        userId={userId}
        buddyName={buddyName}
        phrases={phrases}
        onDisconnected={() => {
          setVoiceEnded((n) => n + 1);
          reloadHistory();
        }}
      />

      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={fetchReview}>
          <Text style={s.actionBtnText}>振り返り 📝</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={fetchMyPhrases}>
          <Text style={s.actionBtnText}>マイフレーズ 📚</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={logout}>
          <Text style={[s.actionBtnText, { color: "#dc2626" }]}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      <View style={s.inputRow}>
        <TextInput
          style={s.input} value={input} onChangeText={setInput}
          placeholder={`Type to ${buddyName}…`} onSubmitEditing={send} returnKeyType="send"
        />
        <Pressable style={s.send} onPress={send}>
          <Text style={s.sendText}>Send</Text>
        </Pressable>
      </View>

      {/* Review modal */}
      <Modal visible={showReview} animationType="slide" onRequestClose={() => setShowReview(false)}>
        <ScrollView style={s.modal} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => setShowReview(false)}>
            <Text style={s.backBtn}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>振り返り</Text>
          {loadingReview && <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />}
          {feedback && !loadingReview && (
            <>
              <Text style={s.sectionTitle}>今日のフレーズ</Text>
              {phrases.map((p) => {
                const used = (feedback.phrases_used ?? []).includes(p.text);
                return (
                  <View key={p.id} style={s.phraseCheck}>
                    <Text style={{ fontSize: 20 }}>{used ? "✅" : "⏳"}</Text>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={s.phraseText}>{p.text}</Text>
                      {!used && <Text style={{ color: "#888", fontSize: 12 }}>また今度出てくるよ</Text>}
                    </View>
                  </View>
                );
              })}
              {feedback.corrections?.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>気になった点</Text>
                  {feedback.corrections.map((c: any, i: number) => (
                    <View key={i} style={s.corrCard}>
                      <Text style={s.corrOrig}>「{c.original}」</Text>
                      <Text style={s.corrArrow}>↓ より自然に</Text>
                      <Text style={s.corrFixed}>「{c.corrected}」</Text>
                      <Text style={s.corrTip}>{c.tip}</Text>
                    </View>
                  ))}
                </>
              )}
              {feedback.rephrasings?.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>もっとナチュラルに 🗣️</Text>
                  {feedback.rephrasings.map((r: any, i: number) => (
                    <View key={i} style={s.corrCard}>
                      <Text style={s.corrOrig}>「{r.original}」</Text>
                      <Text style={s.corrArrow}>↓ ネイティブはこう言う</Text>
                      <Text style={s.corrFixed}>「{r.casual}」</Text>
                      <Text style={s.corrTip}>{r.note}</Text>
                    </View>
                  ))}
                </>
              )}
              {feedback.corrections?.length === 0 && feedback.rephrasings?.length === 0 && (
                <Text style={{ color: "#16a34a", marginTop: 12, fontSize: 16 }}>🎉 Great job!</Text>
              )}
            </>
          )}
        </ScrollView>
      </Modal>

      {/* My Phrases modal */}
      <Modal visible={showMyPhrases} animationType="slide" onRequestClose={() => setShowMyPhrases(false)}>
        <ScrollView style={s.modal} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => setShowMyPhrases(false)}>
            <Text style={s.backBtn}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>マイフレーズ</Text>
          {myPhrases.length === 0 && (
            <Text style={{ color: "#888", marginTop: 20 }}>振り返りをするとここに追加されます。</Text>
          )}
          {myPhrases.map((p, i) => {
            const icon = p.status === "mastered" ? "⭐" : p.status === "used" ? "💪" : "👀";
            return (
              <View key={i} style={s.corrCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.phraseText}>{p.text}</Text>
                    <Text style={s.phraseMeaning}>{p.meaning}</Text>
                  </View>
                  <Text style={{ color: "#888", fontSize: 12 }}>{p.times_used}回</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { margin: 12, padding: 14, backgroundColor: "#f5f3ff", borderRadius: 14, borderWidth: 1, borderColor: "#ddd6fe" },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: "#5b21b6" },
  phraseRow: { marginBottom: 6 },
  phraseText: { fontSize: 15, fontWeight: "600", color: "#1e1b4b" },
  phraseMeaning: { fontSize: 12, color: "#666" },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 14, marginVertical: 4 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  theoBubble: { alignSelf: "flex-start", backgroundColor: "#eee" },
  bubbleText: { fontSize: 16, color: "#000" },
  userText: { color: "#fff" },
  typing: { paddingHorizontal: 16, color: "#888", fontStyle: "italic", fontSize: 13 },
  actions: { flexDirection: "row", borderTopWidth: 1, borderColor: "#eee" },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  actionBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 14, height: 44 },
  send: { backgroundColor: "#2563eb", borderRadius: 20, paddingHorizontal: 18, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "600" },
  modal: { flex: 1, backgroundColor: "#fff" },
  backBtn: { color: "#666", marginBottom: 16, fontSize: 15 },
  modalTitle: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 10, color: "#374151" },
  phraseCheck: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  corrCard: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  corrOrig: { color: "#6b7280", fontSize: 14 },
  corrArrow: { color: "#9ca3af", fontSize: 12, marginVertical: 4 },
  corrFixed: { color: "#111827", fontWeight: "600", fontSize: 15 },
  corrTip: { color: "#6b7280", fontSize: 13, marginTop: 4 },
  allGood: { color: "#16a34a", marginTop: 12, fontSize: 16 },
});

const ob = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  step: { flex: 1, padding: 28, justifyContent: "center" },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 8, color: "#111" },
  sub: { color: "#666", marginBottom: 24, fontSize: 15 },
  label: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 10 },
  nameInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 18, marginBottom: 24 },
  levelBtn: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 16, marginBottom: 10 },
  levelBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  levelLabel: { fontSize: 16, fontWeight: "700", color: "#374151" },
  levelLabelActive: { color: "#2563eb" },
  levelSub: { fontSize: 13, color: "#888", marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#ddd" },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 14, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  btn: { backgroundColor: "#2563eb", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});