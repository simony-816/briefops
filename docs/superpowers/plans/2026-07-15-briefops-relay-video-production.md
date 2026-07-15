# BriefOps Relay Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task.

**Goal:** Produce a submission-ready English product demo under three minutes, while allowing the narrative, captions, and edit to be completed before the real Relay UI is available.

**Architecture:** The edit is scene-driven. Each scene has a fixed duration, scratch narration, a fallback animatic PNG, and an optional real capture clip. `compose.sh` normalizes either source to 1920×1080, concatenates the scenes, adds narration, embeds an English subtitle track, and verifies the final MP4.

**Tech Stack:** Python 3, Pillow, eSpeak for scratch audio, FFmpeg/FFprobe, YAML, H.264/AAC.

## Global Constraints

- Final duration must be less than 180 seconds.
- Final video must show a real product path, not only mockups.
- Git and Codex are supporting evidence; the Relay contract and audit experience are the primary visual subject.
- No copyrighted music or third-party footage.
- No API keys, absolute local paths, or private repository data.
- English narration and captions are required.
- Mock metrics must never be presented as measured results.

---

### Task 1: Lock narrative and timing

**Files:** `storyboard.yaml`, `narration_en.md`, `captions.srt`

- [x] Define nine scenes totaling 172 seconds.
- [x] Write one product claim per scene.
- [x] Keep the opening problem under 18 seconds.
- [x] Keep Git/Codex implementation footage below 36 seconds combined.
- [x] End with the semantic-versus-deterministic architecture distinction.

### Task 2: Build the target animatic

**Files:** `render_assets.py`, `assets/scene-01.png` through `assets/scene-09.png`, `assets/thumbnail.png`

- [x] Render 1920×1080 scenes with readable UI at normal playback size.
- [x] Mark all synthetic screens as `ANIMATIC · MOCK DATA`.
- [x] Show the full product loop: failure → prepare → contract → build → audit → repair → handoff.
- [x] Keep the report UI visually dominant.

### Task 3: Build reproducible composition

**Files:** `compose.sh`, `verify.sh`, `audio/scene-*.wav`

- [x] Accept a real `captures/scene-XX.mp4` or use a fallback PNG.
- [x] Normalize every scene to its storyboard duration and 1920×1080; use 6 fps for the lightweight animatic and 30 fps for the real submission cut.
- [x] Ignore capture audio and use the approved narration track.
- [x] Embed the SRT captions as a selectable MP4 subtitle track.
- [x] Export H.264 video and AAC audio.

### Task 4: Replace mock scenes with real proof

**Files:** `captures/scene-XX.mp4`, `capture_manifest.md`

- [ ] Record the actual Prepare command and outgoing manifest.
- [ ] Record the actual contract and evidence drawer.
- [ ] Record the actual Audit FAIL state.
- [ ] Record Codex repairing the identified findings.
- [ ] Record the actual Audit PASS state and verified handoff.
- [ ] Remove the animatic badge from retained motion-graphic scenes.

### Task 5: Final verification

**Files:** `verify.sh`, `dist/briefops-relay-demo-final.mp4`

- [ ] Verify duration is less than 180 seconds.
- [ ] Verify video is 1920×1080 H.264 and audio is AAC.
- [ ] Watch at 1× without pausing and confirm all essential text is readable.
- [ ] Confirm captions match narration; use YouTube captions or a reviewed burn-in for the submission cut.
- [ ] Confirm no target metric is described as an achieved result.
- [ ] Upload the final cut as a public or unlisted YouTube video acceptable under the competition rules.
