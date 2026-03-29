export type AppLogEvent =
  | "session_create_started"
  | "session_create_succeeded"
  | "session_create_failed"
  | "transak_session_created"
  | "transak_session_failed"
  | "webhook_received"
  | "webhook_invalid"
  | "webhook_duplicate"
  | "webhook_processed"
  | "order_status_changed"
  | "order_status_read";
