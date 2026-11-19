import { defineStore } from "pinia";

type MessageItem = {
  type: "info" | "warning" | "error";
  message: string;
  /** Raised while opening a page, so it belongs to that page. */
  keepOnNavigation?: boolean;
};

export const useMessagesStore = defineStore("messages", {
  state: () => ({
    messages: [] as MessageItem[],
  }),
  actions: {
    dismiss(index: number) {
      this.messages.splice(index, 1);
    },
    info(message: string, options: { keepOnNavigation?: boolean } = {}) {
      this.messages.push({ type: "info", message, ...options });
    },
    warning(message: string) {
      this.messages.push({ type: "warning", message });
    },
    error(message: string) {
      this.messages.push({ type: "error", message });
    },
    /** Drops the last page's messages when another page opens. */
    clearOnNavigation() {
      this.messages = this.messages
        .filter((m) => m.keepOnNavigation)
        .map(({ keepOnNavigation: _, ...m }) => m);
    },
  },
});
