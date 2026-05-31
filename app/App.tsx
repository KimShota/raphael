import { useState, useEffect } from 'react'; 
import {
  View, Text, TextInput, FlatList, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { AppState } from "react-native"; 

const API_URL = "http://172.20.10.13:3000";

type Msg = { role: "user" | "assistant"; content: string };
type Phrase = { text: string, meaning: string, example: string }; 

export default function App(){
  const [messages, setMessages] = useState<Msg[]>([]); 
  const [input, setInput] = useState(""); 
  const [loading, setLoading] = useState(false); 
  const [phrases, setPhrases] = useState<Phrase[]>([]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {phrases.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>今日のフレーズ — 会話で使ってみよう</Text>
          {phrases.map((p, i) => (
            <View key={i} style={styles.phraseRow}>
              <Text style={styles.phraseText}>{p.text}</Text>
              <Text style={styles.phraseMeaning}>{p.meaning}</Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.user : styles.theo]}>
            <Text style={styles.bubbleText}>{item.content}</Text>
          </View>
        )}
      />
      {loading && <Text style={styles.typing}>Theo is typing…</Text>}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type to Theo…"
          onSubmitEditing={send}
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, backgroundColor: "#fff" },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 14, marginVertical: 4 },
  user: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  theo: { alignSelf: "flex-start", backgroundColor: "#eee" },
  bubbleText: { color: "#000", fontSize: 16 },
  user_text: { color: "#fff" },
  typing: { paddingHorizontal: 16, color: "#888", fontStyle: "italic" },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 14, height: 44 },
  send: { backgroundColor: "#2563eb", borderRadius: 20, paddingHorizontal: 18, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "600" },
  card: { margin: 12, padding: 14, backgroundColor: "#f5f3ff", borderRadius: 14, borderWidth: 1, borderColor: "#ddd6fe" },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: "#5b21b6" },
  phraseRow: { marginBottom: 6 },
  phraseText: { fontSize: 16, fontWeight: "600", color: "#1e1b4b" },
  phraseMeaning: { fontSize: 13, color: "#666" },
}); 