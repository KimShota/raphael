import { useState } from 'react'; 
import {
  View, Text, TextInput, FlatList, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";

const API_URL = "http://192.168.0.25:3000";

type Msg = { role: "user" | "assistant"; content: string };

export default function App(){
  const [messages, setMessages] = useState<Msg[]>([]); 
  const [input, setInput] = useState(""); 
  const [loading, setLoading] = useState(false); 

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
          todaysPhrases: ["I'm beat", "no worries", "that's so random"],
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
}); 