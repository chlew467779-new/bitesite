'use client';

import { FormEvent, useState } from 'react';

/**
 * Merchant Feedback — entry point and form only.
 *
 * CH_REQUIRED: where merchant feedback is stored (a new table + migration) or who receives it
 * (an email address / inbox) has not been decided, so this form deliberately sends and stores
 * nothing: no fetch, no mailto, no local persistence. When a destination is approved, wire it
 * here behind FEEDBACK_SENDING_ENABLED and add the API route in its own reviewed change.
 */
export const FEEDBACK_SENDING_ENABLED = false;

const TOPICS = ['Suggestion', 'Something is not working', 'Question about my listing'] as const;
const MESSAGE_LIMIT = 2000;

export function FeedbackPanel() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>(TOPICS[0]);
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Nothing is sent until a destination is approved (see CH_REQUIRED above).
    event.preventDefault();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-describedby="feedback-status">
      <div>
        <label htmlFor="feedback-topic" className="text-sm font-medium text-[#2C3E2D]">
          Topic
        </label>
        <select
          id="feedback-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value as (typeof TOPICS)[number])}
          className="mt-1.5 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-2.5 text-sm text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
        >
          {TOPICS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="feedback-message" className="text-sm font-medium text-[#2C3E2D]">
            Your feedback
          </label>
          <span className="text-xs tabular-nums text-[#6B6560]">
            {message.length.toLocaleString('en-US')}/{MESSAGE_LIMIT.toLocaleString('en-US')}
          </span>
        </div>
        <textarea
          id="feedback-message"
          value={message}
          maxLength={MESSAGE_LIMIT}
          rows={4}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what would make BiteSite more useful for your business."
          className="mt-1.5 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-2.5 text-sm text-[#2C3E2D] placeholder:text-[#9A948E] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!FEEDBACK_SENDING_ENABLED}
          className="rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send feedback
        </button>
        <p id="feedback-status" className="text-xs text-[#6B6560]">
          Sending feedback from the dashboard is not switched on yet. Nothing you type here is sent or saved.
        </p>
      </div>
    </form>
  );
}
