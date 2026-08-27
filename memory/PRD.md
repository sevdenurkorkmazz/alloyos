# AlloyOS — Product Requirements Document

## Original problem statement
Build a "3D AI Company Operating System" (reference-inspired by The Delegation, but
100% original brand/UI/assets). A user creates a company; adds AI employees/agents AND
real human employees; all live as 3D characters in a shared virtual office. Agents-first
(ERP-like, observable in 3D). AI agents do real work; a signature 3D "flying envelope"
animates real communication between desks. Human-in-the-loop approvals. Real backend
events reflect into the 3D world.

## Product name & brand
**AlloyOS** — "Your company, alive." Dark premium SaaS (Linear + Notion + simulation game).
Colors: bg #09090B, AI accent mint #00E599, Human accent orange #FF6B35. Fonts: Cabinet
Grotesk (display), Geist (body), Geist Mono. Grain overlay + glassmorphism over 3D.

## Architecture
- **Backend**: FastAPI + MongoDB (`/app/backend/server.py`). JWT (Bearer) auth, company
  multi-tenant. Unified `employees` collection (type=ai|human). AI engine `run_agent_task()`
  runs real LLM (Emergent Universal Key, Gemini 3 Flash) in background asyncio tasks.
  Events collection + `/api/events?since=` polling drives 3D realtime.
- **Frontend**: React + React Three Fiber. Sidebar layout. Procedural 3D office/characters
  (no imported assets). Pages poll for live updates.
- **Reference/licensing**: The Delegation used ONLY as inspiration; its CC BY-NC 3D assets
  are NOT used. See `/app/THIRD_PARTY_LICENSES.md`.

## User personas
- Founder/Owner (CEO): creates company, agents, invites people, assigns & approves work.
- Human employee: has a customizable 3D character, gets/gives tasks, messages.
- AI agent: autonomous employee that executes tasks and can delegate to coworkers.

## Core requirements (static)
Company/departments, AI agent creation, human invite + avatar customization, 3D office with
per-desk characters + status, task/project system (Backlog→Assigned→Working→Review→Completed),
real AI execution, human-in-the-loop approvals, internal messaging, flying-envelope on real
comms, activity feed, dashboard analytics, multi-tenant isolation, secrets server-side.

## Implemented (2026-06 — MVP)
- Auth (register auto-creates company + 6 departments + CEO character), login, me.
- Dashboard (live stats + activity feed).
- 3D Virtual Office: procedural desks + AI/human characters, status rings + labels,
  orbit controls, flying-envelope animation on real message/task events, live status via polling.
- AI Agents: template-based + custom creation, agent work panel (status, task stats,
  Assign & Run, Delegate-to-coworker), profile.
- Employees: list/filter, invite human with live avatar customizer (skin/hair/facial/shirt/accessory).
- Tasks: Kanban board, create/assign; AI assignment triggers real Gemini run → Review → approval.
- Approvals: terminal-style Approve/Edit/Reject modal (human-in-the-loop).
- Projects, Messages (DM threads incl. AI), Activity feed, Settings (departments).
- Tested: backend 28/28 pytest; frontend all core flows pass (iteration_1.json). Post-fixes:
  approval idempotency, company-scoped message lookups, 404s, office visual cleanup, HUD waiting.

## Backlog (P1)
- AI Project Manager: natural-language → auto-create project, split tasks, assign, deadlines.
- Autonomous agent→agent chains (agent decides to delegate on its own during a run).
- Office customization (desk/room placement, themes).
- Real email integration (sender→envelope→receiver mirrored in 3D).
- WebSocket realtime (replace polling); avatar 3D preview in customizer.

## Backlog (P2)
- Per-agent activity/history timeline, streaming agent thoughts.
- Meeting rooms with grouped characters; break area behaviors (walk/idle pathfinding).
- Notifications center UI; role-based permissions enforcement per agent action.

## Next tasks
- Custom 3D assets: support user-provided GLB (rigged + Idle/Walking/Sitting/Talking clips) via avatar.modelUrl and an office modelUrl loaded with useGLTF.
- Wave 2: visual team/flow editor + sub-agents (hierarchy), multimodal generation (image via Nano Banana, music via Lyria), ready-made team templates.
- i18n gaps: translate CreateAgentDialog labels, agent-panel stat labels, meeting toasts; emit i18n keys for backend activity/notification prose.

## Iteration 2 (2026-06) — Living office + Turkish
- Turkish language support + TR/EN switcher (default Turkish), i18n across nav + all page headers/buttons + Office/Meetings/Login/Register/Settings.
- 3D behaviors: characters have legs, walk, idle-wander, sit at desks when working; agents walk to each other and show speech bubbles on real message events.
- Meeting room + Calendar: schedule (time) or start-now; participants walk to the meeting-room chairs and sit; backend scheduler auto-activates/auto-ends; working agents are not pulled into meetings.
- Per-agent human-in-the-loop auto_approve toggle (create dialog + agent panel).
- Tested: backend 37/37 pass (meetings + auto_approve + regression); fixed CRITICAL Tasks.jsx `t` shadowing crash and several backend guards.

