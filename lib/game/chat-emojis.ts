export const CHAT_EMOJI_CATEGORIES = [
  { key: "faces", label: "Visages", icon: "😊", emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😎 🥸 🤓 🧐 🤔 🤨 😐 😑 😶 🙄 😏 😬 🤐 😴 🥱 😮 😯 😲 😳 🥹 🥺 😢 😭 😤 😠 😡 🤯 😱 😨 😰 😥 😓 🤗 🤭 🫢 🫣 🤫 🫡 🫠 🤤 🤒 🤕 🤢 🤮 🤧 🥵 🥶 😵 😵‍💫 🥴 😈 👿 👻 💀 🤖 💩" },
  { key: "gestures", label: "Gestes", icon: "👍", emojis: "👍 👎 👏 🙌 👐 🤲 🤝 🙏 💪 🦵 👊 ✊ 🤛 🤜 🤞 ✌️ 🤟 🤘 👌 🤌 🤏 👋 🤚 🖐️ ✋ 🖖 🫶 ☝️ 👆 👇 👈 👉 ✍️ 🫵" },
  { key: "hearts", label: "Cœurs et fêtes", icon: "❤️", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 🩷 🩵 🩶 💔 ❤️‍🔥 💕 💖 💗 💓 💞 💘 💝 💯 🔥 ✨ ⭐ 🌟 💫 ⚡ 🎉 🎊 🥳 🎈 🎁 🎂 🍾 🥂" },
  { key: "cycling", label: "Vélo et sport", icon: "🚴", emojis: "🚴 🚴‍♂️ 🚴‍♀️ 🚵 🚵‍♂️ 🚵‍♀️ 🚲 🏁 🏆 🥇 🥈 🥉 🎖️ 🏅 ⏱️ ⏰ 🛠️ ⚙️ 🩹 🚑 💨 🚀 🏔️ ⛰️ 🌄 🛣️ 🌍 ☀️ 🌤️ 🌧️ ⛈️ ❄️ 🌬️ ☔ 💧 🔋 🪫 🎯 💥 👀 💤" },
  { key: "food", label: "Ravito et animaux", icon: "🍌", emojis: "🍌 🍎 🍊 🍋 🍉 🍓 🍒 🥑 🥕 🥖 🥐 🥨 🧀 🍕 🍔 🍟 🌭 🍝 🍚 🍫 🍪 🍩 🍯 🍼 🥤 ☕ 🍵 🍺 🐶 🐱 🦊 🐻 🐼 🐸 🦁 🐯 🐷 🐗 🐵 🦆 🦉 🐝 🦋 🐢 🐌 🦄" },
  { key: "symbols", label: "Symboles", icon: "✅", emojis: "✅ ❌ ❎ ✔️ ❗ ❓ ⁉️ ‼️ ⛔ 🚫 ⚠️ 🆘 🆗 🆒 🆕 🆙 🔝 🔜 🔙 🔄 🔁 ➕ ➖ ➡️ ⬅️ ⬆️ ⬇️ 📈 📉 💰 💸 💎 🧠 🗣️ 💬 📣 🤷 🤦 🙋 🙅 🙆 🤷‍♂️ 🤷‍♀️ 🤦‍♂️ 🤦‍♀️" },
] as const;

export const CHAT_EMOJIS: readonly string[] = [...new Set(
  CHAT_EMOJI_CATEGORIES.flatMap((category) => category.emojis.split(" ")),
)];

// The database shares this finite catalogue; arbitrary strings are never reactions.
export const CHAT_REACTION_EMOJIS = CHAT_EMOJIS;
