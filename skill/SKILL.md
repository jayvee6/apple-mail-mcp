---
name: email-compose-review
description: >
  Use this skill any time you are writing an email or reply on behalf of the user
  via the apple-mail MCP tools (compose_email, reply_email). This means any time
  the user asks you to "write", "draft", "compose", "send", or "reply to" an email —
  even if they phrase it casually. Run every LLM-drafted body through a structured
  review swarm before opening it in Mail. NEVER call compose_email or reply_email
  with your first draft. NEVER pass send: true. Always show the reviewed draft and
  get the user's explicit go-ahead first.
---

# Email Compose Review

You are drafting an email on behalf of a human. Before it reaches Mail, your draft
must survive a multi-pass review. The goal: remove AI writing tells, tighten the
prose, verify facts, and ensure the message lands clearly — all without adding
filler or bloat.

This skill runs on **LLM-drafted text only**. If the user wrote the body themselves
and asks for a review, apply it. If they hand you a body to send as-is, skip the
review and open the draft directly.

---

## The Non-Negotiables

1. **Never call `compose_email` or `reply_email` with your first draft.** Write,
   review, revise — then open the draft.
2. **Always pass `send: false`.** The user sends from Mail after reading it.
   Automatic sending of LLM-drafted email is not acceptable.
3. **Always show the revised draft and wait for explicit approval** before calling
   any MCP tool.

---

## Step 1 — Write the first draft

Write the email body internally. Don't call any MCP tools yet. Just write it.

---

## Step 2 — Run the review swarm

**In Claude Code** (sub-agents available): spawn all five reviewers as parallel
sub-agents in a single message. Each receives the draft and returns specific flagged
issues plus suggested fixes. Collect all five outputs, then proceed to Step 3.

**In Claude Desktop** (no sub-agents): run the five reviews as sequential internal
passes. Be honest and rigorous — don't just nod through each one.

---

### Reviewer 1 — Slop Detector

AI-written email has recognizable tells. Find and remove them all.

**Opening clichés to cut:**
- "I hope this email finds you well"
- "I hope you're doing well / having a great day"
- "I wanted to reach out"
- "Thanks for reaching out"

**Sycophantic filler:**
- "Certainly!", "Absolutely!", "Of course!", "Great question!"
- Any opener that exists only to sound agreeable before the actual content

**Hedge padding:**
- "It's worth noting that", "It's important to mention", "I just wanted to"
- "Please don't hesitate to", "Feel free to"
- "I was wondering if perhaps you might be able to..."

**Corporate buzzwords:**
- leverage, synergy, circle back, touch base, loop in, moving forward,
  going forward, at the end of the day, value-add, bandwidth, deliverable

**Sign-off bloat:**
- "Best regards", "Warm regards", "Kind regards" → use "Best," or nothing,
  unless the context is formal enough to warrant it

The test: read each sentence and ask "would a normal person write this?" If not, cut it.

---

### Reviewer 2 — Copy Editor

Spelling, grammar, punctuation. Specifically:
- Comma splices and run-on sentences
- Subject-verb agreement
- Misused words (affect/effect, its/it's, etc.)
- Inconsistent tense
- Unnecessary capitalization

Fix these silently — don't flag minor grammar corrections in the changelog unless
they change meaning.

---

### Reviewer 3 — Active Voice

Convert weak passive constructions to active where it makes the writing stronger.

| Passive | Active |
|---|---|
| "The issue will be looked into by our team" | "Our team will look into it" |
| "It was decided that the meeting would be moved" | "We moved the meeting" |
| "Your request has been received" | "We received your request" |

**Exception**: passive is correct when the subject is unknown, irrelevant, or when
the object is more important than the actor. Don't force active voice where it
sounds unnatural.

---

### Reviewer 4 — Correctness

Check every claim against the context you were given:

- **Names**: Don't infer a first name from an email address. If you only have
  "j.smith@company.com", use "Hi" or wait for confirmation.
- **Dates and times**: Verify any specific dates mentioned are accurate.
- **Facts**: Don't state anything as fact that wasn't in the context.
- **Tone match**: Does the formality level match the relationship? (Replying to
  a casual thread shouldn't open with "Dear Mr. Smith,")

Flag anything you're uncertain about rather than guessing. The user can fill in
gaps — hallucinated details in email are worse than placeholders.

---

### Reviewer 5 — Logic & Clarity

- Is the purpose of the email clear in the first one or two sentences?
- Is there a specific ask? If so, is it stated directly and early — not buried
  at the end?
- Is the structure logical: context → ask → next steps?
- Any contradictions between sentences?
- Is it the right length? Every sentence should earn its place. Email should be
  as short as the content allows.

---

## Step 3 — Arbiter synthesis

Combine all five reviews into:

1. **Revised draft** — apply every non-conflicting improvement. Where reviewers
   conflict, prefer the version that is clearer and shorter.
2. **Changelog** — brief bullets of what changed and why. Keep this scannable.
3. **Flags** — correctness items you're not certain about (names, dates, facts
   the user should verify before sending).

---

## Step 4 — Show the user

Present the output in this format:

```
**Draft ready for review**

[revised email body]

---
**Changes made:**
- [bullet]
- [bullet]

**Please verify before sending:**
- [correctness flag if any — omit this section entirely if nothing to flag]
```

Then ask: *"Want me to open this as a draft in Mail?"*

Wait for the user to confirm. If they ask for edits, apply them and show the
revised version again. Do not open Mail until they say yes.

---

## Step 5 — Open the draft

Once the user approves, call `compose_email` or `reply_email` with:
- The **reviewed and approved** body
- `send: false` — always

The user reads it once more in Mail and clicks Send themselves. That's the
human-in-the-loop gate that makes this safe to use for real correspondence.
