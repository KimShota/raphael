import { useState, useEffect } from 'react'; 
import {
  View, Text, TextInput, FlatList, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { AppState } from "react-native"; 
import { Modal, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";

const API_URL = "http://172.20.10.13:3000";

type Msg = { role: "user" | "assistant"; content: string };
type Phrase = { id: number; text: string; meaning: string; example: string };

export default function App(){
  const [messages, setMessages] = useState<Msg[]>([]); 
  const [input, setInput] = useState(""); 
  const [loading, setLoading] = useState(false); 
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // display AI buddy's reply 
  useEffect(() => {
    (async () => {
      try {
        const d = await fetch(`${API_URL}/history`).then((r) => r.json());
        const msgs = d.messages ?? [];
        if (msgs.length === 0) {
          const g = await fetch(`${API_URL}/greeting`).then((r) => r.json());
          if (g.reply) setMessages([{ role: "assistant", content: g.reply }]);
        } else {
          setMessages(msgs);
        }
      } catch {}
    })();
  }, []);

  // end the session if the app goes into background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        fetch(`${API_URL}/end-session`, { method: "POST" }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // get today's phrases
  useEffect(() => {
    fetch(`${API_URL}/todays-phrases`)
      .then((r) => r.json()) // get response as json
      .then((d) => setPhrases(d.phrases ?? [])) // get phrases from json data
      .catch(() => {});
  }, []); 

  async function send() {
    const text = input.trim(); 
    if (!text || loading){
      return; 
    }
    // pass in user input and history of conversations 
    const next: Msg[] = [...messages, { role: "user", content: text }]; 
    setMessages(next);
    setInput("");
    setLoading(true);
    
    try {
      // send POST request to send prompt to LLM provider
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          level: "LOWER-INTERMEDIATE",
        }),
      });
      const data = await res.json(); 
      setMessages([...next, { role: "assistant", content: data.reply ?? "(error)" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "(connection error)" }]); 
    } finally{
      setLoading(false); 
    }
  }

  // function to get review 
  async function fetchReview(){
    setLoadingReview(true); 
    setShowReview(true); 
    try {
      // get review
      const res = await fetch(`${API_URL}/review`, { method: "POST" }); 
      const d = await res.json(); 
      setFeedback(d.feedback); 
    } catch (error){
      console.error(error); 
    } finally{
      setLoadingReview(false); 
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 今日のフレーズカード */}
      {phrases.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>今日のフレーズ — 使ってみよう</Text>
          {phrases.map((p) => (
            <View key={p.id} style={styles.phraseRow}>
              <Text style={styles.phraseText}>{p.text}</Text>
              <Text style={styles.phraseMeaning}>{p.meaning}</Text>
            </View>
          ))}
        </View>
      )}
 
      {/* チャット */}
      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.theoBubble]}>
            <Text style={[styles.bubbleText, item.role === "user" && styles.userText]}>
              {item.content}
            </Text>
          </View>
        )}
      />
 
      {loading && <Text style={styles.typing}>Theo is typing…</Text>}
 
      {/* 振り返りボタン */}
      <TouchableOpacity style={styles.reviewBtn} onPress={fetchReview}>
        <Text style={styles.reviewBtnText}>振り返り 📝</Text>
      </TouchableOpacity>
 
      {/* 入力欄 */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type to Theo…"
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
 
      {/* 振り返りモーダル */}
      <Modal
        visible={showReview}
        animationType="slide"
        onRequestClose={() => setShowReview(false)}
      >
        <ScrollView
          style={styles.modal}
          contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
        >
          <TouchableOpacity onPress={() => setShowReview(false)}>
            <Text style={styles.backBtn}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>振り返り</Text>
 
          {loadingReview && (
            <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
          )}
 
          {feedback && !loadingReview && (
            <>
              {/* 今日のフレーズ ✅ / ⏳ */}
              <Text style={styles.sectionTitle}>今日のフレーズ</Text>
              {phrases.map((p) => {
                const used = (feedback.phrases_used ?? []).includes(p.text);
                return (
                  <View key={p.id} style={styles.phraseCheck}>
                    <Text style={{ fontSize: 20 }}>{used ? "✅" : "⏳"}</Text>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.phraseText}>{p.text}</Text>
                      {!used && (
                        <Text style={{ color: "#888", fontSize: 12 }}>
                          また今度出てくるよ
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
 
              {/* 修正 */}
              {feedback.corrections?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    気になった点（{feedback.corrections.length}）
                  </Text>
                  {feedback.corrections.map((c: any, i: number) => (
                    <View key={i} style={styles.corrCard}>
                      <Text style={styles.corrOriginal}>「{c.original}」</Text>
                      <Text style={styles.corrArrow}>↓ より自然に</Text>
                      <Text style={styles.corrFixed}>「{c.corrected}」</Text>
                      <Text style={styles.corrTip}>{c.tip}</Text>
                    </View>
                  ))}
                </>
              )}
 
              {/* 教科書→口語（殺し技） */}
              {feedback.rephrasings?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>もっとナチュラルに 🗣️</Text>
                  {feedback.rephrasings.map((r: any, i: number) => (
                    <View key={i} style={styles.corrCard}>
                      <Text style={styles.corrOriginal}>「{r.original}」</Text>
                      <Text style={styles.corrArrow}>↓ ネイティブはこう言う</Text>
                      <Text style={styles.corrFixed}>「{r.casual}」</Text>
                      <Text style={styles.corrTip}>{r.note}</Text>
                    </View>
                  ))}
                </>
              )}
 
              {feedback.corrections?.length === 0 &&
                feedback.rephrasings?.length === 0 && (
                  <Text style={styles.allGood}>
                    🎉 Great job — no major issues!
                  </Text>
                )}
            </>
          )}
        </ScrollView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, backgroundColor: "#fff" },
 
  // フレーズカード
  card: {
    margin: 12, padding: 14, backgroundColor: "#f5f3ff",
    borderRadius: 14, borderWidth: 1, borderColor: "#ddd6fe",
  },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: "#5b21b6" },
  phraseRow: { marginBottom: 6 },
  phraseText: { fontSize: 15, fontWeight: "600", color: "#1e1b4b" },
  phraseMeaning: { fontSize: 12, color: "#666" },
 
  // バブル
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 14, marginVertical: 4 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  theoBubble: { alignSelf: "flex-start", backgroundColor: "#eee" },
  bubbleText: { fontSize: 16, color: "#000" },
  userText: { color: "#fff" },
  typing: { paddingHorizontal: 16, color: "#888", fontStyle: "italic", fontSize: 13 },
 
  // 振り返りボタン
  reviewBtn: {
    alignItems: "center", paddingVertical: 10,
    borderTopWidth: 1, borderColor: "#eee",
  },
  reviewBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 15 },
 
  // 入力欄
  inputRow: {
    flexDirection: "row", padding: 10, gap: 8,
    borderTopWidth: 1, borderColor: "#eee",
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#ccc",
    borderRadius: 20, paddingHorizontal: 14, height: 44,
  },
  send: {
    backgroundColor: "#2563eb", borderRadius: 20,
    paddingHorizontal: 18, justifyContent: "center",
  },
  sendText: { color: "#fff", fontWeight: "600" },
 
  // モーダル
  modal: { flex: 1, backgroundColor: "#fff" },
  backBtn: { color: "#666", marginBottom: 16, fontSize: 15 },
  modalTitle: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  sectionTitle: {
    fontSize: 16, fontWeight: "700", marginTop: 24,
    marginBottom: 10, color: "#374151",
  },
  phraseCheck: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  corrCard: {
    backgroundColor: "#f9fafb", borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb",
  },
  corrOriginal: { color: "#6b7280", fontSize: 14 },
  corrArrow: { color: "#9ca3af", fontSize: 12, marginVertical: 4 },
  corrFixed: { color: "#111827", fontWeight: "600", fontSize: 15 },
  corrTip: { color: "#6b7280", fontSize: 13, marginTop: 4 },
  allGood: { color: "#16a34a", marginTop: 12, fontSize: 16 },
});