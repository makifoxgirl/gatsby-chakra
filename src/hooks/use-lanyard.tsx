import { useCallback, useEffect, useRef, useState } from "react";

enum Op {
	Event = 0,
	Hello = 1,
	Initialize = 2,
	Heartbeat = 3,
}

enum Type {
	InitState = "INIT_STATE",
	PresenceUpdate = "PRESENCE_UPDATE",
}

interface Message {
	op: Op;
	t: Type;
	d: Partial<DataEvent & DataHello & DataInitialize>;
}

interface DataEvent {
	active_on_discord_desktop: boolean;
	active_on_discord_mobile: boolean;
	active_on_discord_web: boolean;
	activities: {
		assets: {
			large_image: string;
			large_text: string;
		};
		created_at: number;
		flags: number;
		id: string;
		name: string;
		party: {
			id: string;
		};
		session_id: string;
		state: string;
		sync_id: string;
		timestamps: { start: number; end: number };
		type: number;
	}[];
	discord_status: "online" | "offline";
	discord_user: {
		avatar: string;
		discriminator: string;
		id: string;
		public_flags: number;
		username: string;
	};
	listening_to_spotify: boolean;
	spotify: {
		album: string;
		album_art_url: string;
		artist: string;
		song: string;
		timestamps: { start: number; end: number };
		track_id: string;
	};
}

interface DataHello {
	heartbeat_interval: number;
}

interface DataInitialize {
	subscribe_to_ids: string[];
}

export function useLanyard(discordId: string) {
	const socket = useRef<WebSocket>();
	const interval = useRef<any>();
	const [data, setData] = useState<DataEvent>(null);

	const onMessage = useCallback((event: MessageEvent<string>) => {
		let message: Message;
		try {
			message = JSON.parse(event.data);
		} catch (error) {
			console.error(error);
		}
		if (message == null) return;

		switch (message.op) {
			case Op.Hello:
				// after hello, init with discord id
				socket.current.send(
					JSON.stringify({
						op: Op.Initialize,
						d: { subscribe_to_ids: [discordId] },
					} as Message),
				);
				// start the heart beat interval
				interval.current = setInterval(() => {
					socket.current.send(
						JSON.stringify({ op: Op.Heartbeat } as Message),
					);
				}, message.d.heartbeat_interval);
				break;

			case Op.Event:
				let data = message.d as DataEvent;
				// seems to only happen for INIT_STATE
				if (data[discordId] != null) {
					data = data[discordId];
				}
				setData(data);
				break;
		}
	}, []);

	useEffect(() => {
		if (socket.current == null) {
			socket.current = new WebSocket("wss://api.lanyard.rest/socket");
			socket.current.addEventListener("message", onMessage);
		}
		return () => {
			if (interval.current) {
				clearInterval(interval.current);
				interval.current = null;
			}
			if (socket.current) {
				socket.current.removeEventListener("message", onMessage);
				socket.current.close();
				socket.current = null;
			}
		};
	}, []);

	return data;
}
