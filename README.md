# icsa-mobile

The ICSA app — **iPhone, iPad, Mac and Android** — for students, teachers, reception, marketers and managers, built on the ICSA AMS (`app.icsasystem.com`).

**Status (3 Nov 2026): scaffolded.** Decisions ruled, mockups approved, Expo SDK 58 + TypeScript project created (still the Expo demo screens — Phase 1 replaces them).

| Start with | |
|---|---|
| `HANDOVER.md` | the brief for the build chat — goals, decisions to confirm, phases, first steps |
| `CLAUDE.md` | how Yasir works, the two machines, the rules |
| `docs/01-advice.md` | the professional advice |
| `docs/02-features-by-role.md` | every screen → the AMS endpoint behind it |
| `docs/03-ams-server-changes.md` | what the AMS must add for a phone app |
| `docs/04-store-checklist.md` | Apple and Google accounts, rules, review |
| `docs/api-inventory.md` | all AMS endpoints (generated) |
| `mockups/` | the design mockups |

Regenerate the API inventory after AMS changes (**Run on Mac**, in this folder):

```bash
node scripts/api-inventory.js ../icsa-system
```
