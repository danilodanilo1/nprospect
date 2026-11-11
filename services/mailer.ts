// Envio (SMTP) e leitura (IMAP) da caixa de prospecção.
// Use uma caixa num domínio secundário para nunca queimar o domínio principal.
import nodemailer, { type Transporter } from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

export interface IncomingMail {
  uid: number;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  from: string;
  subject: string;
  text: string;
  date: Date;
  isBounce: boolean;
}

let transporter: Transporter | null = null;

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export function fromAddress(): string {
  const name = process.env.MAIL_FROM_NAME ?? "Danilo | nRecruit";
  const addr = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "";
  return `"${name}" <${addr}>`;
}

/** Envia e devolve o Message-ID, que guardamos para encadear os follow-ups. */
export async function sendMail(mail: OutgoingMail): Promise<string> {
  const info = await getTransporter().sendMail({
    from: fromAddress(),
    to: mail.to,
    subject: mail.subject,
    text: mail.body,
    ...(mail.inReplyTo
      ? { inReplyTo: mail.inReplyTo, references: mail.references ?? mail.inReplyTo }
      : {}),
    headers: { "List-Unsubscribe": `<mailto:${process.env.MAIL_FROM ?? process.env.SMTP_USER}?subject=remover>` },
  });
  return info.messageId;
}

const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery subsystem/i;

/** Busca mensagens novas desde o último UID lido. */
export async function fetchNewMail(sinceUid: number): Promise<IncomingMail[]> {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST ?? process.env.SMTP_HOST ?? "",
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user: process.env.IMAP_USER ?? process.env.SMTP_USER ?? "", pass: process.env.IMAP_PASS ?? process.env.SMTP_PASS ?? "" },
    logger: false,
  });
  const out: IncomingMail[] = [];
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    for await (const msg of client.fetch(`${sinceUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
      if (msg.uid <= sinceUid || !msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const from = parsed.from?.value?.[0]?.address?.toLowerCase() ?? "";
      const refs = parsed.references;
      out.push({
        uid: msg.uid,
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        references: Array.isArray(refs) ? refs : refs ? [refs] : [],
        from,
        subject: parsed.subject ?? "",
        text: stripQuoted(parsed.text ?? ""),
        date: parsed.date ?? new Date(),
        isBounce: BOUNCE_FROM.test(parsed.from?.text ?? "") || /delivery status notification|undeliverable|não entregue/i.test(parsed.subject ?? ""),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return out;
}

/** Remove o texto citado ("Em ... escreveu:" e linhas com ">"). */
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const cut = lines.findIndex(
    (l) => /^(em|on) .+(escreveu|wrote):?\s*$/i.test(l.trim()) || /^-{2,}\s*(original message|mensagem original)/i.test(l.trim()),
  );
  const kept = (cut >= 0 ? lines.slice(0, cut) : lines).filter((l) => !l.startsWith(">"));
  return kept.join("\n").trim();
}

/** Para bounces: todos os endereços citados no corpo (o leitor cruza com os leads). */
export function addressesIn(text: string): string[] {
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  return [...new Set(m.map((a) => a.toLowerCase()))];
}
