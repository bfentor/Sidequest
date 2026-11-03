import { createContext, useContext } from 'react';

export type EventPanel = {
  /** The event shown in the panel, if any. */
  selected: number | null;
  open: (id: number) => void;
  close: () => void;
};

const EventPanelContext = createContext<EventPanel | null>(null);

/**
 * The side panel wide desktop browsers show event details in, next to the
 * feed (navigation/app-tabs.web.tsx). Null elsewhere, where events open as
 * their own page.
 */
export function useEventPanel() {
  return useContext(EventPanelContext);
}

export const EventPanelProvider = EventPanelContext.Provider;
