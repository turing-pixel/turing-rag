/** Message log: same max width as composer, no extra horizontal inset. */
export const chatMessageLogClass =
  "chat-message-log mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-5 pt-6";

export const chatConversationContentClass = chatMessageLogClass;

/** Bottom breathing room inside the message scroll viewport. */
export const chatMessageViewportClass = "overscroll-y-contain pb-8";

export const chatConversationFooterClass =
  "shrink-0 pt-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]";

export const chatComposerModelClass =
  "h-8 min-w-0 w-full max-w-full sm:w-auto sm:max-w-[11rem]";

export const chatComposerKbClass =
  "min-w-0 w-full max-w-full sm:w-auto sm:max-w-[14rem]";
