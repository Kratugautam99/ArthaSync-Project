Below is the **complete node-by-node configuration** for all 48 nodes extracted from the ArthaSync canvas.  
Each node is described exactly as you would fill in **Cognizant Superset** (or a low‑code workflow builder like n8n).  
Fields include: **Node ID, Name, Type, Configuration parameters, Inputs, Outputs, Connections**, and special notes (dashed edges, loops, conditions).

> **Note:** The canvas claims 41 nodes but actually contains **48 distinct nodes** (Stages 0–5). All are documented here for full replication.  
> Dashed (`⇢`) connections are **memory / feedback edges** – configure them as separate “memory” or “state” links in Superset.

---

## Stage 0 – Trigger & Early Exit (5 nodes)

### Node 1 – Timer Trigger
| Field | Value |
|-------|-------|
| **Type** | Input / Timer |
| **Name** | Timer Trigger |
| **Description** | Fires the pipeline every 60 seconds, 24×7. The heartbeat of the entire system. |
| **Configuration** | • Interval: 60s<br>• Timezone: Asia/Kolkata<br>• Output payload: `{tick_id, ts_utc, tenant_id}` |
| **Input** | None (trigger) |
| **Output** | `{tick_id, ts_utc, tenant_id}` |
| **Connections** | → Node 2 (always) |

### Node 2 – Fetch Channel Snapshot
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | Fetch Channel Snapshot |
| **Description** | Parallel fan‑out pull from Shopify REST, Amazon SP‑API, and POS CSV on S3. |
| **Configuration** | • Timeout: 8s per source<br>• Fan‑out: parallel (3 threads)<br>• Sources: Shopify, Amazon, POS S3<br>• Output: `{shopify:[], amazon:[], pos:[]}` |
| **Input** | `{tick_id, ts_utc, tenant_id}` |
| **Output** | `{shopify: [...], amazon: [...], pos: [...]}` |
| **Connections** | → Node 3 |

### Node 3 – Snapshot Hash Check
| Field | Value |
|-------|-------|
| **Type** | Custom Code |
| **Name** | Snapshot Hash Check (v2) |
| **Description** | MD5‑hashes the snapshot, compares with Redis‑stored previous hash. Kills 70% of runs. |
| **Configuration** | • Hash: `MD5(json.dumps(snapshot, sort_keys=True))`<br>• Store: Redis SETEX 180s<br>• Key: `hash:{tenant_id}:last`<br>• Output: `{changed: bool, hash: str}` |
| **Input** | Snapshot JSON from Node 2 |
| **Output** | `{changed: true/false, hash: "..."}` |
| **Connections** | → Node 4 |

### Node 4 – Changed Since Last Run?
| Field | Value |
|-------|-------|
| **Type** | Condition / Router |
| **Name** | Changed Since Last Run? |
| **Description** | YES → Stage 1. NO → early exit (Node 5). |
| **Configuration** | • Expression: `$.changed == true`<br>• True branch → Node 6<br>• False branch → Node 5 |
| **Input** | `{changed, hash}` from Node 3 |
| **Output** | Same payload (routed) |
| **Connections** | → Node 6 (if `changed==true`)<br>→ Node 5 (if `changed==false`) |

### Node 5 – Quiet Tick Ack
| Field | Value |
|-------|-------|
| **Type** | Output |
| **Name** | Quiet Tick Ack |
| **Description** | Writes a “skipped” metric row for dashboard observability. Terminal node on no‑change path. |
| **Configuration** | • Table: `tick_log`<br>• Output payload: `{tick_id, status:"skipped", reason:"no_change"}` |
| **Input** | `{tick_id, changed:false}` from Node 4 |
| **Output** | (writes to DB / log) |
| **Connections** | None (terminal) |

---

## Stage 1 – Sync Agent (4 nodes)

### Node 6 – Normalize Schema
| Field | Value |
|-------|-------|
| **Type** | Custom Code |
| **Name** | Normalize Schema |
| **Description** | Flattens vendor‑specific field names before LLM – deterministic, no token cost. |
| **Configuration** | • Field mapping: `variant_sku→sku`, `inventory_qty→qty`, etc.<br>• Rules: combine `shopify/amazon/pos` → canonical<br>• Output: `[{sku, qty, price, source, ts}]` |
| **Input** | Raw snapshot from Node 2 (via Node 4 when changed) |
| **Output** | `[{sku, qty, price, source, ts}]` |
| **Connections** | → Node 7 |

### Node 7 – SKU Master Lookup
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | SKU Master Lookup |
| **Description** | Pulls canonical SKU aliases from Postgres for grounding context before LLM call. |
| **Configuration** | • SQL: `SELECT canonical_sku, aliases FROM sku_master WHERE tenant_id=:t`<br>• Cache: Redis 300s |
| **Input** | List of SKUs from Node 6 |
| **Output** | `{canonical_sku, aliases}` map |
| **Connections** | → Node 8 |

### Node 8 – Sync Agent LLM
| Field | Value |
|-------|-------|
| **Type** | LLM Step |
| **Name** | Sync Agent LLM |
| **Description** | Resolves fuzzy SKU aliases to canonical IDs. Only non‑deterministic call here. |
| **Configuration** | • Model: Claude Haiku<br>• Temperature: 0 (deterministic)<br>• Mode: JSON mode<br>• System prompt: `"You are a SKU normalization agent..."`<br>• Max tokens: 256 |
| **Input** | Normalized SKU list + SKU master data |
| **Output** | Canonical mapping `{original_sku → canonical_sku}` |
| **Connections** | → Node 9 |

### Node 9 – Canonical Inventory JSON
| Field | Value |
|-------|-------|
| **Type** | Output / Formatter |
| **Name** | Canonical Inventory JSON |
| **Description** | Emits the single canonical record that Stage 2 consumes. Dashed out → Conflict Agent. |
| **Configuration** | • Output schema: `{sku, name, channels: {shopify, amazon, pos}}` |
| **Input** | Canonical mapping from Node 8 |
| **Output** | Unified inventory object |
| **Connections** | → Node 10 (main)<br>⇢ (dashed memory edge to feedback logs) |

---

## Stage 2 – Conflict Agent (14 nodes)

### Node 10 – Rule-Based Conflict Detect
| Field | Value |
|-------|-------|
| **Type** | Custom Code |
| **Name** | Rule-Based Conflict Detect |
| **Description** | Checks canonical JSON against conflict rules (price mismatch, oversell, stale listing). Uses Thompson‑sampled weights from Bandit Store. |
| **Configuration** | • Rules: `price_mismatch`, `oversell`, `stale`, `qty_drift`<br>• Weights: from Node 10a (Bandit Store) – per tenant<br>• Thresholds: from Node 10b (Tenant Calibrator) – P85<br>• Output: `[{sku, rule, sev, est_loss_inr}]` |
| **Input** | Canonical inventory from Node 9 |
| **Output** | List of conflicts with severity and estimated loss |
| **Connections** | → Node 11<br>⇢ receives dashed weights from 10a and thresholds from 10b<br>⇢ optionally receives dashed “feature freeze” from Node 30 |

### Node 10a – Bandit Store
| Field | Value |
|-------|-------|
| **Type** | Memory (dashed connection) |
| **Name** | Bandit Store (v3) |
| **Description** | Beta(α,β) per rule‑tenant pair. Thompson samples a weight each run. |
| **Configuration** | • Table: `rule_posteriors(tenant_id, rule_id, alpha, beta)`<br>• Sample: `np.random.beta(α+1, β+1)`<br>• Updated by: Node 17a (Bandit Update) |
| **Input** | None (state only) |
| **Output** | Weight map (dashed → Node 10) |
| **Connections** | ⇢ dashed → Node 10 (provides weights)<br>⇢ receives updates from Node 17a |

### Node 10b – Tenant Calibrator
| Field | Value |
|-------|-------|
| **Type** | Custom Code (nightly) |
| **Name** | Tenant Calibrator (v3) |
| **Description** | Computes P85 of tenant’s own 30‑day legitimate price moves. |
| **Configuration** | • SQL: `percentile_cont(0.85) WITHIN GROUP (ORDER BY delta)`<br>• Schedule: nightly 02:00 IST<br>• Writes to: `tenant_thresholds` table |
| **Input** | 30 days of price delta data |
| **Output** | P85 thresholds (dashed → Node 10) |
| **Connections** | ⇢ dashed → Node 10 |

### Node 11 – Severity Router
| Field | Value |
|-------|-------|
| **Type** | Classifier / Router |
| **Name** | Severity Router |
| **Description** | Tags each conflict LOW / MED / HIGH by estimated monetary impact. |
| **Configuration** | • HIGH: `est_loss > ₹10,000`<br>• MED: `₹1,000 – ₹10,000`<br>• LOW: `< ₹1,000` |
| **Input** | Conflict list from Node 10 |
| **Output** | Same list with `severity` field added |
| **Connections** | → Node 12 |

### Node 12 – Any Conflicts Found?
| Field | Value |
|-------|-------|
| **Type** | Condition |
| **Name** | Any Conflicts Found? |
| **Description** | Short‑circuits to Insight Agent when conflict list is empty. |
| **Configuration** | • Expression: `len($.conflicts) > 0`<br>• True → Node 13<br>• False → Node 18 (skip to Insight) |
| **Input** | Conflict list with severity |
| **Output** | Same payload |
| **Connections** | → Node 13 (if conflicts exist)<br>→ Node 18 (if no conflicts) |

### Node 13 – Loop per Conflict
| Field | Value |
|-------|-------|
| **Type** | Loop |
| **Name** | Loop per Conflict (v2) |
| **Description** | Processes each conflict independently – a bad row cannot poison the batch. |
| **Configuration** | • Mode: `ForEach($.conflicts)`<br>• Parallelism: 5<br>• On error: continue (isolate failures) |
| **Input** | List of conflicts |
| **Output** | Each conflict processed individually (loop body) |
| **Connections** | ↻ → Node 13a (for each conflict) |

### Node 13a – Reserve Action Slot
| Field | Value |
|-------|-------|
| **Type** | Custom Code |
| **Name** | Reserve Action Slot (v3) |
| **Description** | UNIQUE constraint on `action_log` enforces exactly‑once at DB level. Idempotency key prevents double fixes. |
| **Configuration** | • Key: `md5(tenant\|sku\|type\|channel\|price\|date)`<br>• DB: `INSERT OR IGNORE INTO action_log`<br>• Duplicate → skip branch (no‑op) |
| **Input** | Single conflict object |
| **Output** | Reserved slot or skip signal |
| **Connections** | → Node 13b |

### Node 13b – Token Bucket Check
| Field | Value |
|-------|-------|
| **Type** | Guardrail |
| **Name** | Token Bucket Check (v3) |
| **Description** | Per‑tenant Redis leaky bucket: 50 tokens, refills 10/min. Empty = auto‑mode OFF. |
| **Configuration** | • Algorithm: Leaky Bucket (RFC 2698)<br>• Capacity: 50 tokens<br>• Refill: 10 tokens/min<br>• If empty → route to Node 13c (alert) then Node 17 (human) |
| **Input** | Reserved action slot |
| **Output** | `bucket_ok: true/false` |
| **Connections** | → Node 14 (if bucket ok)<br>→ Node 13c (if bucket empty) |

### Node 13c – Auto-Mode Tripped Alert
| Field | Value |
|-------|-------|
| **Type** | Guardrail |
| **Name** | Auto-Mode Tripped Alert (v3) |
| **Description** | Pages owner, posts dashboard banner, logs incident. Fires when rate limit exhausted. |
| **Configuration** | • Channels: Telegram + email + dashboard banner<br>• Next: → Node 17 (Human Handoff) |
| **Input** | Conflict that caused bucket empty |
| **Output** | Alert sent, then continues to human handoff |
| **Connections** | → Node 17 |

### Node 14 – Post Resolution API
| Field | Value |
|-------|-------|
| **Type** | Tool |
| **Name** | Post Resolution API |
| **Description** | Calls Shopify PUT /variants or Amazon Feed API with idempotency key. Exponential backoff. |
| **Configuration** | • Shopify: `PUT /admin/api/variants/{id}.json`<br>• Amazon: `POST /feeds (SubmitFeed)`<br>• Retry: exponential backoff ×3, jitter 200ms<br>• Header: `X-Idempotency-Key: {action_id}` |
| **Input** | Conflict + resolution action |
| **Output** | API response status |
| **Connections** | → Node 15 |

### Node 15 – Log to conflict_log
| Field | Value |
|-------|-------|
| **Type** | Memory |
| **Name** | Log to conflict_log |
| **Description** | Immutable event row – Stage 3’s retrieval source. Append‑only, never updated. |
| **Configuration** | • Columns: `ts, tenant, sku, type, sev, delta, resolved_by`<br>• Mode: INSERT only |
| **Input** | Resolved conflict |
| **Output** | (writes to DB) |
| **Connections** | → Node 16 |

### Node 16 – Amount > ₹50K?
| Field | Value |
|-------|-------|
| **Type** | Condition |
| **Name** | Amount > ₹50K? |
| **Description** | Human‑in‑the‑loop gate for financially material fixes. |
| **Configuration** | • Threshold: `est_loss_inr > 50000`<br>• Basis: 3.5× avg daily SME revenue<br>• Yes → Node 17<br>• No → Node 18 |
| **Input** | Logged conflict |
| **Output** | Same conflict |
| **Connections** | → Node 17 (if >50K)<br>→ Node 18 (if ≤50K) |

### Node 17 – Telegram + SMS Handoff
| Field | Value |
|-------|-------|
| **Type** | Human Handoff |
| **Name** | Telegram + SMS Handoff (v2) |
| **Description** | Telegram first; 5‑min no‑ACK → MSG91 SMS fallback. |
| **Configuration** | • Primary: Telegram Bot API<br>• Fallback: MSG91 SMS (5 min timeout)<br>• Actions: `APPROVE`, `SKIP`<br>• ACK → Node 17a |
| **Input** | High‑severity or rate‑limited conflict |
| **Output** | Human decision (`APPROVE`/`SKIP`) |
| **Connections** | → Node 17a (after human response) |

### Node 17a – Bandit Update on ACK
| Field | Value |
|-------|-------|
| **Type** | Memory |
| **Name** | Bandit Update on ACK (v3) |
| **Description** | On APPROVE → α+=1 (rule validated). On SKIP → β+=1 (rule over‑fired). Closes the learning loop. |
| **Configuration** | • APPROVE: `UPDATE rule_posteriors SET alpha=alpha+1`<br>• SKIP: `UPDATE rule_posteriors SET beta=beta+1` |
| **Input** | Human decision + rule ID |
| **Output** | Updated posterior (dashed → Node 10a) |
| **Connections** | ⇢ dashed → Node 10a |

---

## Stage 3 – Insight Agent (12 nodes)

### Node 18 – 7‑Day Conflict History
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | 7‑Day Conflict History |
| **Description** | Rolling week of conflict_log – grounding context for the LLM. |
| **Configuration** | • SQL: `WHERE ts > NOW() - INTERVAL '7 days' AND tenant=:t`<br>• Order: ts DESC, LIMIT 50 |
| **Input** | Tenant ID |
| **Output** | List of recent conflicts |
| **Connections** | → Node 18a |

### Node 18a – Cold‑Start Gate
| Field | Value |
|-------|-------|
| **Type** | Condition |
| **Name** | Cold‑Start Gate (v3) |
| **Description** | Routes new tenants (<7 days data) to peer cohort retrieval instead of thin own data. |
| **Configuration** | • Expression: `history_days >= 7`<br>• True → Node 19<br>• False → Node 18b |
| **Input** | History record count / days |
| **Output** | Same payload + routing flag |
| **Connections** | → Node 19 (if ≥7 days)<br>→ Node 18b (if <7 days) |

### Node 18b – Peer Cohort (Bayesian)
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | Peer Cohort (Bayesian) (v3) |
| **Description** | Anonymized same‑vertical cohort data. Bayesian shrinkage blends tenant + cohort by data maturity. |
| **Configuration** | • Blend λ: `days_of_data / 7`<br>• Formula: `λ·tenant_data + (1‑λ)·cohort_data`<br>• Prompt flag: `early_stage=true` |
| **Input** | Tenant ID, vertical |
| **Output** | Blended conflict patterns |
| **Connections** | → Node 19 |

### Node 19 – Few‑Shot System Prompt
| Field | Value |
|-------|-------|
| **Type** | Prompt Template |
| **Name** | Few‑Shot System Prompt (v2) |
| **Description** | 2 worked examples (pricing drift, oversell) locking JSON shape. |
| **Configuration** | • Examples: `pricing_drift`, `oversell` (2 shots)<br>• Output schema: `{"bullet":"•...","confidence":0-1}`<br>• Max bullet: 25 words, starts with “•” |
| **Input** | Conflict history (own or cohort) |
| **Output** | Formatted prompt for LLM |
| **Connections** | → Node 20 |

### Node 20 – Insight Agent LLM
| Field | Value |
|-------|-------|
| **Type** | LLM Step |
| **Name** | Insight Agent LLM |
| **Description** | Produces the single most‑visible artifact – the daily business bullet. |
| **Configuration** | • Model: Claude Haiku<br>• Temperature: 0.3<br>• Max tokens: 120<br>• Output: `{bullet: str, confidence: float}` |
| **Input** | Prompt from Node 19 (or Node 22 on retry) |
| **Output** | Bullet + confidence score |
| **Connections** | → Node 21 |

### Node 21 – Confidence >= threshold?
| Field | Value |
|-------|-------|
| **Type** | Condition |
| **Name** | Confidence >= threshold? (v2) |
| **Description** | Threshold is per‑tenant (isotonic calibration), NOT fixed 0.7. |
| **Configuration** | • Source: `tenant_thresholds.confidence_min`<br>• Cold start: 0.7 (default)<br>• Yes → Node 23<br>• No → Node 22 |
| **Input** | `{bullet, confidence}` |
| **Output** | Same payload |
| **Connections** | → Node 23 (if confidence ≥ threshold)<br>→ Node 22 (if confidence < threshold) |

### Node 21a – Bullet Feedback Log
| Field | Value |
|-------|-------|
| **Type** | Memory (dashed connection) |
| **Name** | Bullet Feedback Log (v3) |
| **Description** | Logs every (confidence, owner_accepted) pair. Training data for isotonic calibrator. |
| **Configuration** | • Columns: `ts, tenant, bullet_id, confidence, accepted (bool)` |
| **Input** | Bullet + owner feedback (from dashboard) |
| **Output** | (stores row) |
| **Connections** | ⇢ dashed → Node 21b (nightly) |

### Node 21b – Isotonic Calibrator
| Field | Value |
|-------|-------|
| **Type** | Custom Code (nightly) |
| **Name** | Isotonic Calibrator (v3) |
| **Description** | `sklearn.isotonic` fit on feedback log. Threshold = lowest raw confidence where precision ≥ 0.9. |
| **Configuration** | • Library: `sklearn.isotonic.IsotonicRegression`<br>• Min samples: 200 before fitting<br>• Cold start: 0.7 default<br>• Writes to: `tenant_thresholds.confidence_min` |
| **Input** | Feedback log from Node 21a |
| **Output** | Updated thresholds (dashed → Node 21) |
| **Connections** | ⇢ dashed → Node 21 |

### Node 22 – 30‑Day Deep History
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | 30‑Day Deep History (v2) |
| **Description** | Low‑confidence fallback. Loops back to Node 20 once with richer context. |
| **Configuration** | • SQL: `WHERE ts > NOW() - INTERVAL '30 days'`<br>• Max re‑queries: 1 per bullet<br>• Loop flag: `deep_retry=true` (stops infinite loop) |
| **Input** | Tenant ID, bullet ID |
| **Output** | Enriched conflict history |
| **Connections** | ↻ → Node 20 (max 1 retry) |

### Node 23 – Regex Fact‑Verify
| Field | Value |
|-------|-------|
| **Type** | Guardrail |
| **Name** | Regex Fact‑Verify (v2) |
| **Description** | Layer 1 of 2: catches fabricated ₹ values, INR formats, K‑suffix numbers, case‑insensitive SKU check. |
| **Configuration** | • Regex: `(?:Rs\.?\|₹\|INR)\s?([\d,]+(?:\.\d+)?)[Kk]?`<br>• SKU check: `re.search(sku, bullet, re.IGNORECASE)`<br>• Pass → Node 23a |
| **Input** | Bullet text + SKU list |
| **Output** | `passed: true/false` |
| **Connections** | → Node 23a (if passed)<br>(if failed, bullet is rejected and logged) |

### Node 23a – LLM‑as‑Judge Verifier
| Field | Value |
|-------|-------|
| **Type** | Guardrail |
| **Name** | LLM‑as‑Judge Verifier (v3) |
| **Description** | Layer 2: second Haiku call extracts all claims; set‑membership check. |
| **Configuration** | • Pattern: LLM‑as‑Judge (Zheng et al. 2023)<br>• Model: Claude Haiku (separate call)<br>• Check: `claims ⊆ conflict_log facts`<br>• Cost: ~₹0.02/bullet |
| **Input** | Bullet text + conflict facts |
| **Output** | `verified: true/false` |
| **Connections** | → Node 24 (if verified)<br>(if not verified, bullet is dropped) |

### Node 24 – Dashboard JSON
| Field | Value |
|-------|-------|
| **Type** | Output |
| **Name** | Dashboard JSON |
| **Description** | Payload React dashboard polls every 5s via Axios. Closes the feedback loop via dashed edge back to 21a. |
| **Configuration** | • Output schema: `{ts, bullet, confidence, conflicts_today, revenue_saved_inr}`<br>• Poll: React Axios every 5s |
| **Input** | Verified bullet |
| **Output** | JSON for dashboard |
| **Connections** | ⇢ dashed → Node 21a (owner feedback) |

---

## Stage 4 – Analyst Agent (7 nodes)

### Node 25 – Weekly Timer
| Field | Value |
|-------|-------|
| **Type** | Input / Timer |
| **Name** | Weekly Timer |
| **Description** | Sunday 06:00 IST cron. Independent pipeline from the 60s tick. |
| **Configuration** | • Cron: `0 6 * * 0`<br>• Timezone: Asia/Kolkata |
| **Input** | None |
| **Output** | Trigger timestamp |
| **Connections** | → Node 26 |

### Node 26 – 7‑Day Aggregate
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | 7‑Day Aggregate |
| **Description** | Aggregated counters, not raw rows – keeps context small for Sonnet. Top 20 SKUs by drift. |
| **Configuration** | • SQL: `GROUP BY sku, type ORDER BY rs_drift DESC LIMIT 20` |
| **Input** | Tenant ID |
| **Output** | Top 20 drifting SKUs + stats |
| **Connections** | → Node 27 and Node 27a (parallel fan‑out) |

### Node 27 – Analyst Run A
| Field | Value |
|-------|-------|
| **Type** | LLM Step |
| **Name** | Analyst Run A |
| **Description** | Claude Sonnet, seed 42 – weekly 5‑bullet executive pattern memo. First of dual runs. |
| **Configuration** | • Model: Claude Sonnet<br>• Temperature: 0.4, Seed: 42<br>• Output: `[{bullet, claim_set}]` (5 items) |
| **Input** | Aggregated data from Node 26 |
| **Output** | 5 bullets + claims |
| **Connections** | → Node 27b |

### Node 27a – Analyst Run B
| Field | Value |
|-------|-------|
| **Type** | LLM Step |
| **Name** | Analyst Run B (v3) |
| **Description** | Same prompt, seed 17. Used for self‑consistency check. |
| **Configuration** | • Model: Claude Sonnet<br>• Temperature: 0.4, Seed: 17<br>• Pattern: Wang et al. 2022 Self‑Consistency |
| **Input** | Aggregated data from Node 26 |
| **Output** | 5 bullets + claims |
| **Connections** | → Node 27b |

### Node 27b – Self‑Consistency Intersect
| Field | Value |
|-------|-------|
| **Type** | Custom Code |
| **Name** | Self‑Consistency Intersect (v3) |
| **Description** | Publishes ONLY claims appearing in BOTH runs. Set intersection kills one‑off hallucinations. |
| **Configuration** | • Operation: `claims_A ∩ claims_B`<br>• Match: fuzzy (SequenceMatcher ratio > 0.85)<br>• Discard: any claim not in both runs |
| **Input** | Two claim sets from Node 27 and 27a |
| **Output** | Intersected claims |
| **Connections** | → Node 27c |

### Node 27c – Aggregate Fact‑Verify
| Field | Value |
|-------|-------|
| **Type** | Guardrail |
| **Name** | Aggregate Fact‑Verify (v3) |
| **Description** | Same regex + LLM‑as‑judge pattern as nodes 23/23a, applied to 7‑day aggregate data. |
| **Configuration** | • Rejects: bullets with unsourced ₹ or SKUs<br>• Source: Node 26 (7d aggregate) |
| **Input** | Intersected claims + aggregate data |
| **Output** | Verified bullet set |
| **Connections** | → Node 28 |

### Node 28 – Executive Email + Pattern Feed
| Field | Value |
|-------|-------|
| **Type** | Output |
| **Name** | Executive Email + Pattern Feed |
| **Description** | SendGrid email to merchant + dashboard Pattern Feed widget. The weekly touchpoint with owner. |
| **Configuration** | • Email: SendGrid API, template: `weekly_digest`<br>• DB: `INSERT INTO pattern_feed` |
| **Input** | Verified weekly patterns |
| **Output** | Email sent + feed updated |
| **Connections** | None (terminal) |

---

## Stage 5 – Mirror Agent (6 nodes)

### Node 31 – Hourly Timer
| Field | Value |
|-------|-------|
| **Type** | Input / Timer |
| **Name** | Hourly Timer (v3) |
| **Description** | The Mirror’s heartbeat. Separate from the 60s main tick. Independent failure domain. |
| **Configuration** | • Cron: `0 * * * *`<br>• Timezone: Asia/Kolkata<br>• Isolated from Node 1 |
| **Input** | None |
| **Output** | Trigger timestamp |
| **Connections** | → Node 32 |

### Node 32 – System Metrics KR
| Field | Value |
|-------|-------|
| **Type** | Knowledge Retrieval |
| **Name** | System Metrics KR (v3) |
| **Description** | Pulls confidence distribution, bucket trip count, rejection rate, contradictions. System‑only – no business data. |
| **Configuration** | • Metrics: `confidence_dist`, `bucket_trips`, `rejection_rate`, `contradictions`<br>• Source: `system_metrics` table |
| **Input** | (none) |
| **Output** | System KPIs |
| **Connections** | → Node 33 |

### Node 33 – Drift Detector KS+CUSUM
| Field | Value |
|-------|-------|
| **Type** | Custom Code |
| **Name** | Drift Detector KS+CUSUM (v3) |
| **Description** | Kolmogorov‑Smirnov 2‑sample test + CUSUM + EWMA. Any of 4 signals firing → drift=true. |
| **Configuration** | • Methods: KS‑test, CUSUM, EWMA, threshold breach<br>• α: 0.05 (significance level)<br>• Trigger: ANY 1 of 4 signals → drift=true |
| **Input** | System metrics over time |
| **Output** | `{drift: true/false, signal_details}` |
| **Connections** | → Node 34 (if drift true)<br>→ idle (if drift false) |

### Node 34 – Mirror Agent LLM
| Field | Value |
|-------|-------|
| **Type** | LLM Step |
| **Name** | Mirror Agent LLM (v3) |
| **Description** | Sonnet introspects system metrics and proposes ONE concrete self‑heal action. Constrained output. |
| **Configuration** | • Model: Claude Sonnet<br>• Constraint: Must propose exactly 1 action<br>• Output: `{sentence, proposed_action, urgency: low\|med\|high}` |
| **Input** | Drift signal + metrics |
| **Output** | Self‑heal proposal |
| **Connections** | → Node 35 |

### Node 35 – Owner Notification + Self‑Heal
| Field | Value |
|-------|-------|
| **Type** | Output |
| **Name** | Owner Notification + Self‑Heal (v3) |
| **Description** | Sends the introspection + one‑click self‑heal button to owner via Telegram and dashboard card. |
| **Configuration** | • Channels: Telegram + dashboard card<br>• Action: One‑click self‑heal webhook |
| **Input** | Mirror proposal |
| **Output** | Notification sent |
| **Connections** | None (terminal) |

### Node 30 – Error Budget Monitor
| Field | Value |
|-------|-------|
| **Type** | Guardrail (continuous) |
| **Name** | Error Budget Monitor (v3) |
| **Description** | Runs continuously; when SLO budget exhausted → automatic feature freeze. Dashed to Node 10. |
| **Configuration** | • SLO: p50 ≤ 15s, p99 ≤ 45s, 99.5% availability<br>• Budget: 3h 36m downtime/month<br>• Exhausted → dashed feature freeze → Node 10 |
| **Input** | Real‑time system SLO metrics |
| **Output** | `feature_freeze: true/false` |
| **Connections** | ⇢ dashed → Node 10 (freeze rule‑based detection) |

---

## Summary of Connections (Edges)

All sequential (`→`) and conditional edges are listed in the table below (dashed `⇢` edges are noted as “memory” in the individual node configurations above).

| From | To | Condition / Type |
|------|----|------------------|
| 1 → 2 | always | sequential |
| 2 → 3 | always | sequential |
| 3 → 4 | always | sequential |
| 4 → 5 | changed == false | conditional |
| 4 → 6 | changed == true | conditional |
| 6 → 7 | always | sequential |
| 7 → 8 | always | sequential |
| 8 → 9 | always | sequential |
| 9 → 10 | always | sequential |
| 10 → 11 | always | sequential |
| 11 → 12 | always | sequential |
| 12 → 13 | len(conflicts) > 0 | conditional |
| 12 → 18 | len(conflicts) == 0 | conditional |
| 13 → 13a | for each conflict | loop |
| 13a → 13b | always | sequential |
| 13b → 14 | bucket ok | conditional |
| 13b → 13c | bucket empty | conditional |
| 13c → 17 | always | sequential |
| 14 → 15 | always | sequential |
| 15 → 16 | always | sequential |
| 16 → 17 | est_loss > 50000 | conditional |
| 16 → 18 | est_loss ≤ 50000 | conditional |
| 17 → 17a | after human ack | sequential |
| 18 → 18a | always | sequential |
| 18a → 19 | history_days ≥ 7 | conditional |
| 18a → 18b | history_days < 7 | conditional |
| 18b → 19 | always | sequential |
| 19 → 20 | always | sequential |
| 20 → 21 | always | sequential |
| 21 → 23 | confidence ≥ threshold | conditional |
| 21 → 22 | confidence < threshold | conditional |
| 22 → 20 | max 1 retry | loop |
| 23 → 23a | regex passed | sequential |
| 23a → 24 | verified | sequential |
| 25 → 26 | always | sequential |
| 26 → 27 | fan‑out | parallel |
| 26 → 27a | fan‑out | parallel |
| 27 → 27b | wait for both | sequential |
| 27a → 27b | wait for both | sequential |
| 27b → 27c | always | sequential |
| 27c → 28 | always | sequential |
| 31 → 32 | always | sequential |
| 32 → 33 | always | sequential |
| 33 → 34 | drift == true | conditional |
| 33 → (idle) | drift == false | conditional |
| 34 → 35 | always | sequential |

**Dashed (memory) edges:**  
* 10a ⇢ 10 (weights)  
* 10b ⇢ 10 (thresholds)  
* 17a ⇢ 10a (Bayesian update)  
* 21a ⇢ 21b (feedback log)  
* 21b ⇢ 21 (calibrated threshold)  
* 24 ⇢ 21a (owner feedback)  
* 30 ⇢ 10 (feature freeze)

---

You can now copy each node’s configuration directly into Cognizant Superset.  
The pipeline is ready to replicate – every label, field, and connection is explicitly defined.