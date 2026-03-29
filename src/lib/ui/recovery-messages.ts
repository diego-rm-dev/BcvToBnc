export type NoticeTone = "info" | "warning" | "error";

export type NoticeContent = {
  tone: NoticeTone;
  title: string;
  message: string;
};

type SessionErrorPhase = "session_create" | "transak_session" | "widget_open";

export function getSessionErrorNotice(input: {
  phase: SessionErrorPhase;
  rawMessage: string;
}): NoticeContent {
  const message = input.rawMessage.toLowerCase();

  if (message.includes("too many requests")) {
    return {
      tone: "warning",
      title: "Demasiados intentos en poco tiempo",
      message: "Espera unos segundos y vuelve a intentarlo."
    };
  }

  if (input.phase === "transak_session" || message.includes("transak") || message.includes("widgeturl")) {
    return {
      tone: "error",
      title: "No se pudo preparar el checkout del proveedor",
      message: "Intenta de nuevo. Si persiste, usa el enlace de estado y vuelve a iniciar la compra."
    };
  }

  if (input.phase === "widget_open") {
    return {
      tone: "warning",
      title: "No se abrió la ventana del checkout",
      message: "Puedes abrir el checkout manualmente o consultar el estado de la orden."
    };
  }

  return {
    tone: "error",
    title: "No se pudo iniciar la compra",
    message: "Revisa los datos e inténtalo nuevamente."
  };
}

export function getQuoteFallbackNotice(disclaimer?: string): NoticeContent {
  return {
    tone: "warning",
    title: "Se usó monto fijo por falta de cotización en tiempo real",
    message:
      disclaimer ??
      "La cotización no estuvo disponible. Se continuará con el monto fijo configurado."
  };
}

export function getStatusErrorNotice(input: {
  tokenMissing: boolean;
  rawMessage?: string;
}): NoticeContent {
  if (input.tokenMissing) {
    return {
      tone: "error",
      title: "Enlace incompleto para consultar la orden",
      message: "Abre el enlace completo recibido al crear la compra o inicia una nueva operación."
    };
  }

  const raw = input.rawMessage?.toLowerCase() ?? "";
  if (raw.includes("order not found")) {
    return {
      tone: "error",
      title: "No se pudo validar esta consulta",
      message:
        "El token de acceso puede ser inválido o la orden no existe. Inicia una nueva compra si necesitas continuar."
    };
  }

  return {
    tone: "error",
    title: "No se pudo consultar el estado",
    message: "Intenta refrescar en unos segundos."
  };
}

export function getStatusProgressNotice(status: string): NoticeContent | null {
  if (status === "PENDING" || status === "WAITING_PAYMENT" || status === "PROCESSING") {
    return {
      tone: "info",
      title: "La orden sigue en proceso",
      message:
        "Si el webhook tarda en llegar, este estado puede demorarse en actualizar. Usa “Refrescar” cada cierto tiempo."
    };
  }

  if (status === "FAILED") {
    return {
      tone: "error",
      title: "La orden falló",
      message: "Puedes reintentar desde el inicio con una nueva orden."
    };
  }

  if (status === "EXPIRED") {
    return {
      tone: "warning",
      title: "La orden expiró",
      message: "Debes iniciar una nueva compra para continuar."
    };
  }

  return null;
}
