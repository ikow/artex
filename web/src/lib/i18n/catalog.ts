import common from "./messages/common.json";
import agents from "./messages/agents.json";
import approvals from "./messages/approvals.json";
import assets from "./messages/assets.json";
import auth from "./messages/auth.json";
import chat from "./messages/chat.json";
import dashboard from "./messages/dashboard.json";
import findings from "./messages/findings.json";
import interfaceMessages from "./messages/interface.json";
import models from "./messages/models.json";
import settings from "./messages/settings.json";
import tasks from "./messages/tasks.json";
import controls from "./messages/controls.json";

// Chinese source messages are stable gettext-style keys. Keeping the originals
// as the Chinese catalog avoids two copies of every source sentence drifting.
export const english: Readonly<Record<string, string>> = {
  ...agents, ...approvals, ...assets, ...auth, ...chat, ...common,
  ...dashboard, ...findings, ...interfaceMessages, ...models, ...settings,
  ...tasks, ...controls,
};
export const chinese: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(english).map((key) => [key, key.split("\u0004").at(-1)!]),
);
