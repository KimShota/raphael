import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { getOrCreateSession, getUser } from "./db.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export type LiveKitTokenPayload = {
  token: string;
  url: string;
  roomName: string;
  sessionId: string;
};

export async function createLiveKitToken(userId: string): Promise<LiveKitTokenPayload> {
  const apiKey = requireEnv("LIVEKIT_API_KEY");
  const apiSecret = requireEnv("LIVEKIT_API_SECRET");
  const url = requireEnv("LIVEKIT_URL");
  const agentName = process.env.LIVEKIT_AGENT_NAME ?? "raphael-buddy";

  const user = await getUser(userId);
  const sessionId = await getOrCreateSession(userId);
  const roomName = `raphael-${userId}-${sessionId}`;

  const dispatchMetadata = JSON.stringify({
    userId,
    sessionId,
    level: user?.level ?? "LOWER-INTERMEDIATE",
    buddyName: user?.buddy_name ?? "Theo",
  });

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: user?.buddy_name ?? "Learner",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  at.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName,
        metadata: dispatchMetadata,
      }),
    ],
  });

  const token = await at.toJwt();

  return { token, url, roomName, sessionId };
}
