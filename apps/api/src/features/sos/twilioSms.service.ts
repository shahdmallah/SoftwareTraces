import twilio from "twilio";
import { env } from "../../config/env";

export type TwilioSmsStatus = "sent" | "skipped" | "failed";

export interface TwilioSmsResult {
  status: TwilioSmsStatus;
  provider: "twilio";
  provider_message_id: string | null;
  error: string | null;
}

const internationalPhoneRegex = /^\+[1-9]\d{7,14}$/;

export function isValidInternationalPhone(phone: string | null | undefined): phone is string {
  return typeof phone === "string" && internationalPhoneRegex.test(phone.trim());
}

export function buildSosSmsBody(input: {
  userName: string;
  latitude: number;
  longitude: number;
  message?: string | null;
}): string {
  const message = input.message?.trim() ? input.message.trim() : "No message provided.";
  return `SOS Alert from Traces: ${input.userName} triggered an emergency alert. Location: https://maps.google.com/?q=${input.latitude},${input.longitude}. Message: ${message}`;
}

function twilioConfigStatus(): { enabled: boolean; reason?: string } {
  if (!env.TWILIO_SMS_ENABLED) {
    return { enabled: false, reason: "Twilio SMS is disabled" };
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return { enabled: false, reason: "Twilio SMS configuration is incomplete" };
  }

  return { enabled: true };
}

export async function sendTwilioSms(to: string, body: string): Promise<TwilioSmsResult> {
  const config = twilioConfigStatus();
  if (!config.enabled) {
    return {
      status: "skipped",
      provider: "twilio",
      provider_message_id: null,
      error: config.reason ?? "Twilio SMS unavailable",
    };
  }

  try {
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      from: env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });

    return {
      status: "sent",
      provider: "twilio",
      provider_message_id: message.sid,
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "twilio",
      provider_message_id: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
