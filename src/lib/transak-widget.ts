import type { TransakConfig } from "@transak/ui-js-sdk";

type TransakEventName =
  | "TRANSAK_WIDGET_INITIALISED"
  | "TRANSAK_ORDER_CREATED"
  | "TRANSAK_ORDER_SUCCESSFUL"
  | "TRANSAK_ORDER_CANCELLED"
  | "TRANSAK_ORDER_FAILED"
  | "TRANSAK_WALLET_REDIRECTION"
  | "TRANSAK_WIDGET_CLOSE_REQUEST"
  | "TRANSAK_WIDGET_CLOSE";

type TransakEventPayload = unknown;

type EventCallback = (event: { type: TransakEventName; payload: TransakEventPayload }) => void;

type TransakSessionCallbacks = {
  onEvent?: EventCallback;
  onWidgetClose?: () => void;
  onOrderSuccessful?: () => void;
};

export type OpenTransakWidgetInput = {
  widgetUrl: string;
  callbacks?: TransakSessionCallbacks;
};

export type TransakWidgetController = {
  close: () => void;
  cleanup: () => void;
};

type TransakCtor = {
  EVENTS: Record<TransakEventName, TransakEventName>;
  on: (type: TransakEventName, cb: (data: unknown) => void) => void;
  new (config: TransakConfig): {
    init: () => void;
    close: () => void;
    cleanup: () => void;
  };
};

type ActiveSession = {
  instance: {
    init: () => void;
    close: () => void;
    cleanup: () => void;
  };
  callbacks?: TransakSessionCallbacks;
  released: boolean;
};

let sdkPromise: Promise<{ Transak: TransakCtor }> | null = null;
let listenersBound = false;
let activeSession: ActiveSession | null = null;

function loadTransakSdk() {
  if (!sdkPromise) {
    sdkPromise = import("@transak/ui-js-sdk") as Promise<{ Transak: TransakCtor }>;
  }
  return sdkPromise;
}

function releaseActiveSession() {
  if (!activeSession || activeSession.released) return;

  activeSession.released = true;
  try {
    activeSession.instance.cleanup();
  } catch {
    // Ignoramos errores de cleanup para no bloquear flujo de UI.
  }

  activeSession = null;
}

function bindGlobalListeners(Transak: TransakCtor) {
  if (listenersBound) return;

  const forward = (type: TransakEventName, payload: unknown) => {
    if (!activeSession || activeSession.released) return;

    activeSession.callbacks?.onEvent?.({ type, payload });

    if (type === "TRANSAK_ORDER_SUCCESSFUL") {
      activeSession.callbacks?.onOrderSuccessful?.();
      releaseActiveSession();
      return;
    }

    if (type === "TRANSAK_WIDGET_CLOSE") {
      activeSession.callbacks?.onWidgetClose?.();
      releaseActiveSession();
    }
  };

  Transak.on("TRANSAK_WIDGET_INITIALISED", (payload) =>
    forward("TRANSAK_WIDGET_INITIALISED", payload)
  );
  Transak.on("TRANSAK_ORDER_CREATED", (payload) => forward("TRANSAK_ORDER_CREATED", payload));
  Transak.on("TRANSAK_ORDER_SUCCESSFUL", (payload) =>
    forward("TRANSAK_ORDER_SUCCESSFUL", payload)
  );
  Transak.on("TRANSAK_ORDER_CANCELLED", (payload) =>
    forward("TRANSAK_ORDER_CANCELLED", payload)
  );
  Transak.on("TRANSAK_ORDER_FAILED", (payload) => forward("TRANSAK_ORDER_FAILED", payload));
  Transak.on("TRANSAK_WALLET_REDIRECTION", (payload) =>
    forward("TRANSAK_WALLET_REDIRECTION", payload)
  );
  Transak.on("TRANSAK_WIDGET_CLOSE_REQUEST", (payload) =>
    forward("TRANSAK_WIDGET_CLOSE_REQUEST", payload)
  );
  Transak.on("TRANSAK_WIDGET_CLOSE", (payload) => forward("TRANSAK_WIDGET_CLOSE", payload));

  listenersBound = true;
}

export async function openTransakWidget(
  input: OpenTransakWidgetInput
): Promise<TransakWidgetController> {
  if (typeof window === "undefined") {
    throw new Error("El widget de Transak solo puede abrirse en el navegador.");
  }

  if (!input.widgetUrl || !/^https?:\/\//i.test(input.widgetUrl)) {
    throw new Error("widgetUrl inválida.");
  }

  const { Transak } = await loadTransakSdk();
  bindGlobalListeners(Transak);

  releaseActiveSession();

  const instance = new Transak({
    widgetUrl: input.widgetUrl
  });

  activeSession = {
    instance,
    callbacks: input.callbacks,
    released: false
  };

  instance.init();

  return {
    close() {
      if (!activeSession || activeSession.released) return;
      try {
        activeSession.instance.close();
      } finally {
        releaseActiveSession();
      }
    },
    cleanup() {
      releaseActiveSession();
    }
  };
}
